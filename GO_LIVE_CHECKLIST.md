# Passo a passo: o que voce PRECISA fazer para o Antropia Desk operar 100%

## Contexto

O sistema esta deployado em https://desk.antrop-ia.com, login admin funciona, banco populado com 5 service plans + 18 categorias. Mas **2 coisas externas ao codigo** travam o funcionamento end-to-end de notificacoes, SLA e relatorios:

1. **Cron jobs** que chamam as edge functions do Supabase nao estao agendados — sem isso, notificacoes ficam empilhadas para sempre
2. **Canais de envio (SMTP/WhatsApp)** sem credenciais cadastradas — sem isso, nada sai mesmo se cron rodar

Este plano detalha **EXATAMENTE** o que precisa ser feito por voce em cada caso, com clique-a-clique.

---

# PARTE 1 — Configurar Cron Jobs (CRITICO)

**Tempo estimado**: 10 min
**Dificuldade**: media (envolve copiar SQL e clicar em Run)
**Quem faz**: voce OU eu (se autorizar)

## O que e e por que importa

O Supabase tem 3 funcoes-cron (`process-notifications`, `check-sla`, `generate-reports`). Elas ficam paradas — alguem precisa "tocar a campainha" delas a cada minuto/30min/hora.

Como voce nao tem servidor cron externo, vamos usar a propria extensao **pg_cron** do Postgres do Supabase para fazer isso. As extensoes ja estao habilitadas, so falta agendar.

## Opcao A — eu executo via CLI (recomendado)

Voce me autoriza pelo chat e eu rodo um unico comando que faz tudo:
- Gera token aleatorio CRON_SECRET (ja gerei)
- Salva nos secrets das edge functions (ja salvei via `supabase secrets set`)
- Cria os 3 cron jobs no banco

**O que voce precisa fazer**: confirmar com "pode" e ja era. Nada mais.

## Opcao B — voce executa via Supabase Dashboard

### Passo 1: gerar o CRON_SECRET

No seu terminal local:
```bash
openssl rand -hex 32
```

Copie a saida (ex: `d445db05f3...336afb55`). Vou chamar de `<CRON_SECRET>` daqui pra frente.

### Passo 2: setar o secret nas Edge Functions

No browser, va em:
```
https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/functions/secrets
```

Clique em **"Add new secret"** e adicione:
- Name: `CRON_SECRET`
- Value: `<o token que voce gerou>`

Salvar.

### Passo 3: rodar SQL no SQL Editor

No browser, abra:
```
https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud/sql/new
```

Cole o SQL abaixo (substitua `<CRON_SECRET>` pelo seu token gerado):

```sql
-- Habilitar extensoes (se nao estiverem)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Salvar secret no Vault (so o postgres tem acesso)
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret('<CRON_SECRET>', 'cron_secret', 'Token usado pelo pg_cron para chamar edge functions');
  ELSE
    UPDATE vault.secrets SET secret = '<CRON_SECRET>' WHERE id = v_id;
  END IF;
END $$;

-- Limpar jobs antigos (idempotente — pode rodar varias vezes sem problema)
DO $$ BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN ('process-notifications-job','check-sla-job','generate-reports-job');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Job 1: processa notificacoes pendentes a cada 1 minuto
SELECT cron.schedule('process-notifications-job', '* * * * *', $job$
  SELECT net.http_post(
    url := 'https://wevgxuxaplcmrnsktoud.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);

-- Job 2: checa SLA (warning 2h antes, breach apos vencer) a cada 30 min
SELECT cron.schedule('check-sla-job', '*/30 * * * *', $job$
  SELECT net.http_post(
    url := 'https://wevgxuxaplcmrnsktoud.supabase.co/functions/v1/check-sla',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);

-- Job 3: gera reports agendados a cada hora
SELECT cron.schedule('generate-reports-job', '0 * * * *', $job$
  SELECT net.http_post(
    url := 'https://wevgxuxaplcmrnsktoud.supabase.co/functions/v1/generate-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
```

Clicar em **RUN** (verde, canto inferior direito). Deve retornar `Success. No rows returned`.

### Passo 4: validar que esta funcionando

Cole esta query no mesmo SQL Editor:

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Resultado esperado: 3 linhas com `active = true`:
```
check-sla-job              */30 * * * *   t
generate-reports-job        0 * * * *     t
process-notifications-job   * * * * *     t
```

E para ver se ja executaram (depois de ~2 min):
```sql
SELECT jobname, status, return_message, start_time
FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 10;
```

Resultado esperado: linhas com `status = 'succeeded'`. Se aparecer `failed`, o erro estara em `return_message`.

---

# PARTE 2 — Configurar SMTP (CRITICO, so voce pode fazer)

**Tempo estimado**: 15-30 min (depende de ja ter conta no provedor)
**Dificuldade**: facil (apenas UI)
**Quem faz**: SOMENTE voce — exige credenciais externas

## Por que so voce pode

Cadastrar SMTP exige criar conta em provedor de email, ler chave de API, copiar e colar. Eu nao tenho acesso a contas externas.

## Escolher um provedor

Recomendados (do mais simples ao mais robusto):

| Provedor | Free tier | Configuracao | Indicado para |
|---|---|---|---|
| **Resend** | 100/dia, 3k/mes | API key — 5 min | Mais simples, comecar |
| **Mailgun** | 100/dia | SMTP user+pass — 10 min | Quem ja usa |
| **AWS SES** | 62k/mes (de EC2) | IAM + SMTP creds — 30 min | Volume maior |
| **SendGrid** | 100/dia | API key — 10 min | Tambem comum |

**Sugestao**: comece com **Resend** (resend.com). E o mais rapido.

## Passo a passo com Resend

### Passo 1: criar conta
1. Va em https://resend.com
2. Cadastre-se com `accounts@antrop-ia.com`
3. Confirme o email

### Passo 2: validar dominio (importante para nao cair em spam)
1. No dashboard Resend → **Domains** → **Add Domain**
2. Digite `antrop-ia.com`
3. Resend mostra registros DNS (3-4 entradas tipo TXT/CNAME)
4. Adicione esses registros no seu provedor de DNS (mesmo lugar onde aponta `desk.antrop-ia.com`)
5. Volte no Resend e clique **Verify** — deve ficar verde em ~5 min

### Passo 3: gerar API key
1. Resend dashboard → **API Keys** → **Create API Key**
2. Nome: `antropia-desk-prod`
3. Permission: **Sending access** (ou Full)
4. Copie a chave (so aparece uma vez): `re_xxxxxxxxxxxxx`

### Passo 4: configurar no Antropia Desk
1. Abra https://desk.antrop-ia.com
2. Login com `admin@antrop-ia.com` / `Antrop1a`
3. Va em `Configuracoes` → `Canais` (ou `/admin/settings`)
4. Aba **Email** → ative
5. Preencha:
   - SMTP Host: `smtp.resend.com`
   - SMTP Port: `465`
   - SMTP User: `resend`
   - SMTP Password: a API key `re_xxxxxxxxxxxxx`
   - From Email: `noreply@antrop-ia.com` (o dominio que voce verificou)
   - From Name: `Antropia Desk`
6. Salvar
7. Clique em **Testar canal** → digite seu email pessoal
8. Email de teste deve chegar em ~30s

Se chegar: SMTP OK, sistema vai enviar emails de tickets, convites, SLA, etc.
Se nao chegar: ver caixa de spam, conferir DNS Resend, conferir API key.

---

# PARTE 3 — Trocar senha do admin (URGENTE)

**Tempo**: 1 min
**Dificuldade**: trivial
**Quem faz**: voce

A senha `Antrop1a` e provisoria e esta documentada em multiplos lugares (PANORAMA.md, RELATORIO, este plano). **Trocar agora**.

1. Login em https://desk.antrop-ia.com
2. Canto superior direito → seu nome → `Perfil`
3. Aba `Senha` → digite senha atual `Antrop1a` + nova senha forte (12+ chars, com numero/simbolo)
4. Salvar
5. Logout/login para confirmar

---

# PARTE 4 — Branding e onboarding de cliente (15-30 min)

**Quem faz**: voce

## 4.1 — Logo e cores
1. `/admin/settings` → aba `Branding`
2. URL do logo: pode usar `https://desk.antrop-ia.com/antropia-logo.svg` (o atual) ou subir outro
3. Salvar

## 4.2 — Convidar primeiro cliente
1. `/admin/users` → `Convidar usuario`
2. Email do cliente, nome, role = `USER`
3. Selecionar service plans (ja tem 5 disponiveis: Agentes IA, SmartFlows, Trafego Pago, Dev Web/App, Infra)
4. Convidar
5. Cliente recebera email para definir senha (precisa SMTP funcionando — Parte 2)

## 4.3 — Convidar agente da equipe
1. Mesmo processo, mas role = `AGENT`
2. AGENT nao precisa de service plan (ele atende todos)

---

# Sequencia recomendada

```
1. Trocar senha admin              [1 min]   ← AGORA
2. Configurar cron (Parte 1)        [10 min]  ← eu posso fazer ou voce
3. Configurar SMTP via Resend      [30 min]  ← so voce
4. Testar envio de email           [5 min]
5. Configurar branding             [15 min]
6. Convidar 1 agente piloto        [5 min]
7. Convidar 1 cliente piloto       [5 min]
8. Cliente cria primeiro ticket    [5 min]
9. Validar fluxo end-to-end        [10 min]
```

**Total**: ~1h30 para sistema 100% operacional com primeiros clientes piloto.

---

# Resumo: o que e INEVITAVEL voce fazer

| # | Acao | Tempo | Por que |
|---|---|---|---|
| 1 | Trocar senha admin | 1 min | Senha atual e publica neste repo |
| 2 | Criar conta no provedor de email (Resend recomendado) | 5 min | So voce pode |
| 3 | Validar dominio no provedor (DNS records) | 10 min | So voce tem acesso ao DNS |
| 4 | Gerar API key e cadastrar em `/admin/settings → Canais` | 5 min | So voce tem a chave |
| 5 | Testar envio de email | 2 min | Validacao final |
| 6 | Configurar branding com logo da empresa | 5 min | Decisao de design |
| 7 | Convidar primeiros usuarios | varia | Decisao de quem entra |

**Itens que eu posso fazer por voce se autorizar**: 1 (configurar cron via CLI).

---

# Verificacao final

Apos completar os passos:

```bash
# Cron rodando?
# (rodar no SQL Editor do Supabase)
SELECT jobname, status, start_time
FROM cron.job_run_details
WHERE start_time > NOW() - INTERVAL '5 minutes'
ORDER BY start_time DESC;

# Notificacoes saindo do PENDING?
SELECT status, COUNT(*) FROM notifications GROUP BY status;
# Deve ter SENT ou DELIVERED, nao so PENDING
```

Apos cliente piloto criar primeiro ticket:
- Email de confirmacao chega em ~1 min (cron + SMTP)
- Status do ticket muda no dashboard
- SLA aparece corretamente (por causa do trigger ja aplicado)

---

# Acao deste plano

Plano de leitura/educacao — **nao requer execucao**. Voce decide:
- Quer que eu execute a Parte 1 (cron) via CLI? Volte ao chat e diga "pode" / "executa"
- Vai fazer voce mesmo? Siga este documento como guia

Posso tambem salvar este passo a passo no projeto (ex: `GO_LIVE_CHECKLIST.md`) para que fique versionado e voce/futuros desenvolvedores tenham acesso.
