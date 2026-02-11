# 🔒 APLICAR CORREÇÕES CRÍTICAS DE SEGURANÇA - SEMANA 1

## RESUMO EXECUTIVO
**Status:** ✅ **MIGRAÇÕES CRIADAS** - Prontas para aplicação
**Impacto:** 🔴 **CRÍTICO** - Resolve vazamentos de dados entre organizações
**Tempo estimado:** 2-5 minutos para aplicação

---

## 🚨 CORREÇÕES IMPLEMENTADAS

### 1. **Row Level Security (RLS) Habilitado**
- ✅ `tickets` - Tabela principal protegida
- ✅ `ticket_timeline` - Histórico protegido
- ✅ `attachments` - Arquivos protegidos
- ✅ `notifications` - Notificações protegidas
- ✅ `workflows` - Automações protegidas
- ✅ `integrations_config` - Credenciais API protegidas
- ✅ `integration_logs` - Logs protegidos
- ✅ `user_notification_preferences` - Preferências protegidas
- ✅ `organization_notification_settings` - Configurações sensíveis protegidas
- ✅ `report_templates` - Templates protegidos
- ✅ `organization_settings` - Configurações protegidas

### 2. **Políticas de Isolamento por Organização**
- ✅ Usuários só veem dados de sua organização
- ✅ Admins podem gerenciar configurações sensíveis
- ✅ Agents têm permissões adequadas
- ✅ Service role mantém acesso para sistemas

### 3. **Função RPC Segura**
- ✅ `test_notification_settings` agora valida organização
- ✅ Apenas Admin/Agent podem testar configurações
- ✅ Funções helper criadas para validações

---

## 🛠️ MÉTODOS DE APLICAÇÃO

### **MÉTODO 1: Supabase Dashboard (RECOMENDADO)**

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/wevgxuxaplcmrnsktoud
   - Vá para "SQL Editor"

2. **Aplique Migration 1:**
   ```sql
   -- Copie o conteúdo completo do arquivo:
   -- /home/antropia/antropia-desk-13649/supabase/migrations/20260203230000_critical_rls_security_fixes.sql
   -- Cole no SQL Editor e execute
   ```

3. **Aplique Migration 2:**
   ```sql
   -- Copie o conteúdo completo do arquivo:
   -- /home/antropia/antropia-desk-13649/supabase/migrations/20260203230001_fix_rpc_functions_security.sql
   -- Cole no SQL Editor e execute
   ```

### **MÉTODO 2: Supabase CLI (Se Disponível)**

```bash
# Instalar CLI (via package manager oficial)
# Ver: https://github.com/supabase/cli#install-the-cli

# Configurar projeto
supabase init
supabase link --project-ref wevgxuxaplcmrnsktoud

# Aplicar migrações
supabase db push
```

### **MÉTODO 3: Via Script SQL Direto**

```bash
# Se você tem psql disponível:
psql "postgresql://[user]:[password]@[host]:5432/postgres" \
  -f /home/antropia/antropia-desk-13649/supabase/migrations/20260203230000_critical_rls_security_fixes.sql

psql "postgresql://[user]:[password]@[host]:5432/postgres" \
  -f /home/antropia/antropia-desk-13649/supabase/migrations/20260203230001_fix_rpc_functions_security.sql
```

---

## ✅ VALIDAÇÃO DAS CORREÇÕES

### **1. Testar RLS (Após Aplicação)**

```sql
-- No SQL Editor do Supabase, execute:
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tickets', 'ticket_timeline', 'attachments',
    'notifications', 'workflows', 'integrations_config'
  );

-- RESULTADO ESPERADO: rowsecurity = true para todas
```

### **2. Testar Políticas de Isolamento**

```sql
-- Verificar se políticas foram criadas:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tickets';

-- RESULTADO ESPERADO: 4 políticas (SELECT, INSERT, UPDATE, DELETE)
```

### **3. Testar Função RPC**

```sql
-- Tentar função com org_id inválido (deve falhar):
SELECT test_notification_settings('EMAIL', gen_random_uuid(), 'test@example.com');

-- RESULTADO ESPERADO:
-- {"success": false, "error": "Access denied: You do not belong to this organization"}
```

---

## 📊 IMPACTO ESPERADO

### **ANTES (VULNERÁVEL):**
```sql
-- ❌ Usuário da Org A podia ver dados da Org B:
SELECT * FROM tickets; -- Via RLS OFF
-- Retornava: TODOS os tickets de TODAS as organizações
```

### **DEPOIS (SEGURO):**
```sql
-- ✅ Usuário da Org A só vê dados da Org A:
SELECT * FROM tickets; -- Via RLS ON
-- Retorna: Apenas tickets de SUA organização
```

---

## 🚨 BACKUP E ROLLBACK

### **ANTES DE APLICAR - BACKUP**
```sql
-- No SQL Editor, backup das políticas existentes:
SELECT 'CREATE POLICY "' || policyname || '" ON ' || schemaname||'.'||tablename ||
       ' FOR ' || cmd || ' USING (' || qual || ');' as backup_command
FROM pg_policies
WHERE schemaname = 'public';
```

### **ROLLBACK (Se Necessário)**
```sql
-- Para reverter, desabilitar RLS:
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_timeline DISABLE ROW LEVEL SECURITY;
-- ... etc para outras tabelas

-- E remover políticas:
DROP POLICY IF EXISTS "Users can only see tickets from their organization" ON public.tickets;
-- ... etc para outras políticas
```

---

## 🎯 VERIFICAÇÃO FINAL

### **Checklist Pós-Aplicação:**

- [ ] **RLS habilitado** em todas as 11+ tabelas críticas
- [ ] **Políticas criadas** para isolamento por organização
- [ ] **Função test_notification_settings** validando organização
- [ ] **Teste manual** - usuário não vê dados de outras orgs
- [ ] **Aplicação funciona** normalmente (sem quebrar features)

### **Comando de Verificação Rápida:**
```sql
-- Execute para ver status geral:
SELECT
  t.table_name,
  CASE WHEN p.rowsecurity THEN '✅ RLS Enabled' ELSE '❌ RLS Disabled' END as rls_status,
  COUNT(pol.policyname) as policy_count
FROM information_schema.tables t
LEFT JOIN pg_tables p ON p.tablename = t.table_name AND p.schemaname = 'public'
LEFT JOIN pg_policies pol ON pol.tablename = t.table_name AND pol.schemaname = 'public'
WHERE t.table_schema = 'public'
  AND t.table_name IN ('tickets', 'attachments', 'notifications', 'workflows', 'integrations_config')
GROUP BY t.table_name, p.rowsecurity
ORDER BY t.table_name;
```

---

## ⏰ PRÓXIMOS PASSOS (SEMANA 2)

Após aplicar essas correções críticas:

1. **Migrar credenciais para Supabase Vault** (smtp_password, api_keys)
2. **Implementar audit trail** para tracking de mudanças
3. **Adicionar soft delete** em tabelas críticas
4. **Testes automatizados** de segurança

---

## 🆘 SUPORTE

**Se algo der errado:**
1. **Verificar logs** no Supabase Dashboard > Logs
2. **Testar queries** uma a uma no SQL Editor
3. **Rollback** usando comandos acima
4. **Contatar desenvolvedor** que criou as migrações

**Arquivos criados:**
- `/home/antropia/antropia-desk-13649/supabase/migrations/20260203230000_critical_rls_security_fixes.sql`
- `/home/antropia/antropia-desk-13649/supabase/migrations/20260203230001_fix_rpc_functions_security.sql`

---

## 🎉 STATUS ATUAL

✅ **MIGRAÇÕES CRIADAS E PRONTAS**
🔄 **AGUARDANDO APLICAÇÃO NO BANCO**
🎯 **IMPACTO: Segurança crítica resolvida**

**Execute essas migrações IMEDIATAMENTE para proteger os dados dos usuários!** 🔒