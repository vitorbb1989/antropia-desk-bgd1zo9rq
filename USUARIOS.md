# Usuários — Antropia Desk

> Doc de uso interno. Lista de logins do sistema (Supabase Auth) + procedimento para confirmar novos usuários.
> Fonte primária dos dados: `PANORAMA.md`, `.env`, `GO_LIVE_CHECKLIST.md`, `SUPABASE_RUNBOOK.md`.

## 1. Tabela de logins

Logins reais que acessam a aplicação em `https://desk.antrop-ia.com`.

| # | Email                    | Senha                                  | Role  | User ID                                | Status   | Notas |
|---|--------------------------|----------------------------------------|-------|----------------------------------------|----------|-------|
| 1 | `admin@antrop-ia.com`    | `<ROTACIONADA-VER-COFRE>` (provisória) | ADMIN | `3a2e3957-ab7f-448a-b6cd-f27e3b172c52` | Ativo    | Organização: Antrop-IA (`e74f0f7c-7ad7-4e69-a41e-f46a1e8c5ea8`). Senha original estava versionada em `.md` — **rotacionada**, valor atual no cofre (Bitwarden / GCP Secret Manager). Trocar de novo se ainda não foi (ver [SUPABASE_RUNBOOK.md §A.1](SUPABASE_RUNBOOK.md)). |

### Contas que NÃO são login do app

| Endereço                | Função                                                                                  |
|-------------------------|------------------------------------------------------------------------------------------|
| `accounts@antrop-ia.com`| Destinatário de alertas (Cloud Monitoring uptime, `db-size-alert`). Não loga no Desk.    |
| `noreply@antrop-ia.com` | Remetente de emails transacionais via Resend SMTP. Não loga.                              |

## 2. Confirmação de novos usuários

Quando um usuário é criado via UI (`/admin/users → Convidar`) ou via RPC `public.create_user_in_org()`
(definida em `supabase/migrations/20260211000000_fix_user_onboarding.sql`), o
`email_confirmed_at` já é setado para `NOW()` automaticamente — ou seja, **o usuário entra confirmado**
e só precisa definir senha pelo link de "Esqueceu a senha".

### 2.1 — Como verificar/confirmar manualmente

```sql
-- Listar usuários e status de confirmação
select
  u.email,
  u.email_confirmed_at is not null as confirmed,
  m.role,
  o.name as org,
  u.created_at
from auth.users u
left join public.memberships m on m.user_id = u.id
left join public.organizations o on o.id = m.organization_id
order by u.created_at desc;

-- Confirmar email de um usuário específico (caso tenha ficado pendente)
update auth.users
set email_confirmed_at = now()
where email = 'novo@exemplo.com'
  and email_confirmed_at is null;
```

Rodar no SQL Editor do Supabase (projeto `wevgxuxaplcmrnsktoud`).

### 2.2 — Ao adicionar um novo usuário aqui

Quando criar um login novo via UI/RPC/Auth admin, adicione uma linha na tabela acima com:

- Email, role (`ADMIN` / `AGENT` / `USER`), User ID retornado, data de criação na coluna **Notas**.
- Senha: se a senha foi definida pelo próprio usuário via "Esqueceu a senha", anote `<DEFINIDA-PELO-USUARIO>` em vez do texto claro. Só use texto claro se for uma senha provisória que vai ser trocada no primeiro login.

## 3. Onde estão as outras credenciais (não-login)

| Credencial                          | Onde fica                                       | Arquivo de referência |
|-------------------------------------|-------------------------------------------------|-----------------------|
| Supabase anon/publishable key       | `.env` (segura para versionar)                  | `.env.example`        |
| Supabase service_role_key           | GCP Secret Manager (`supabase-service-key`)     | `GCP_RUNBOOK.md`      |
| DB password (Postgres pooler)       | GCP Secret Manager (`supabase-db-url`)          | `SUPABASE_RUNBOOK.md` |
| `CRON_SECRET`                       | Edge Function secrets + Vault Supabase          | `GCP_RUNBOOK.md`      |
| `SUPABASE_SERVICE_ROLE_KEY` (edge)  | Edge Function secrets                           | `SUPABASE_RUNBOOK.md` |
| Resend API key (SMTP)               | GCP Secret Manager + Supabase Auth → SMTP       | `SUPABASE_RUNBOOK.md` |
| Sentry DSN, Evolution webhook, etc. | GCP Secret Manager                              | `GCP_RUNBOOK.md`      |
