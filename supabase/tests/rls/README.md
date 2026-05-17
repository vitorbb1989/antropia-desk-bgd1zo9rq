# Testes pgtap de RLS

Validam **isolamento entre organizações** — a única coisa que separa cliente A de cliente B no banco compartilhado.

## Por que existe

~60 policies RLS escritas à mão em 23 migrations. Sem teste = qualquer migration futura pode reintroduzir vazamento sem ninguém notar. Já houve incidente real (`20260203230000_critical_rls_security_fixes.sql`, `20260505120000_fix_kb_articles_user_visibility.sql`).

## Pré-requisitos

1. **Projeto Supabase de staging** dedicado (NUNCA rodar em produção — os testes inserem dados).
2. **Extensão `pgtap`** habilitada no projeto staging:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgtap;
   ```
3. **Variável `STAGING_DB_URL`** apontando para staging (com `service_role` ou usuário com permissão de bypass RLS para o setup):
   ```bash
   export STAGING_DB_URL="postgresql://postgres.<projeto-staging>:<pwd>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
   ```

## Como rodar

```bash
# Suite completa
for f in supabase/tests/rls/*.sql; do
  echo "=== $f ==="
  psql "$STAGING_DB_URL" -f "$f"
done

# Ou um arquivo específico
psql "$STAGING_DB_URL" -f supabase/tests/rls/tickets_isolation.sql
```

Saída esperada: cada `SELECT plan(N)` seguido de `ok N - <descricao>`. Qualquer `not ok` é regressão de RLS.

## Estrutura dos testes

Cada arquivo testa uma **tabela** e segue o padrão:

1. `BEGIN; SELECT plan(N);`
2. **Setup**: insere 2 organizações + 2 users (um por org) + dados em cada
3. **Asserts** por papel (USER, AGENT, ADMIN) e por operação (SELECT, UPDATE, DELETE) — validar que cross-org é bloqueado
4. `SELECT * FROM finish(); ROLLBACK;` — não polui o banco

## Tabelas cobertas hoje

- `tickets_isolation.sql` — isolamento de tickets entre orgs

## Tabelas a adicionar (prioridade)

- `kb_articles_isolation.sql` — KB cross-org + visibilidade DRAFT por papel
- `notifications_isolation.sql` — notificações cross-org
- `attachments_isolation.sql` — anexos cross-org (acessar `attachments` de outra org não deve revelar arquivos do Storage)
- `integrations_config_isolation.sql` — API keys de integração nunca vazam

## CI

Hoje a suite roda **apenas manualmente** (precisa de staging dedicado). Para automatizar:

```yaml
# .github/workflows/rls-tests.yml (futuro)
name: RLS tests
on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
      - 'supabase/tests/rls/**'
jobs:
  rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get install -y postgresql-client
      - name: Run pgtap suite
        env:
          STAGING_DB_URL: ${{ secrets.STAGING_DB_URL }}
        run: |
          for f in supabase/tests/rls/*.sql; do psql "$STAGING_DB_URL" -f "$f"; done
```
