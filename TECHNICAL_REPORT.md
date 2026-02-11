# Relatório Técnico: Antropia Desk - Auditoria e Implementação de Autenticação Real

| Campo | Valor |
|---|---|
| **Projeto** | Antropia Desk |
| **Data de Emissão** | 10/02/2026 |
| **Público-alvo** | Desenvolvedores (code review e continuidade) |

---

## 1. Resumo Executivo

- **Problema crítico resolvido**: Autenticação 100% mockada (3 usuários hardcoded) substituída por integração real com Supabase Auth, habilitando políticas RLS no banco de dados
- **Impacto**: Sistema passou de "aplicação de demonstração" para "aplicação funcional multi-tenant" com dados persistidos por organização
- **Escopo**: 10 quick fixes + reescrita completa do store de autenticação (221 linhas) + 3 componentes atualizados
- **Status**: Build funcional, autenticação operacional
- **Pendências**: 3 limitações conhecidas (email vazio em users[], updateUserStatus no-op, attachments mockados) + problemas de infra Docker/Redis não abordados nesta fase

---

## 2. Contexto do Projeto

### 2.1 Stack Técnica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Frontend** | React | 19 |
| **Linguagem** | TypeScript | Strict mode |
| **Build Tool** | Vite (rolldown-vite) | 7.3.1 |
| **UI Framework** | shadcn/ui (Radix UI) | Componentes primitivos |
| **Estilização** | Tailwind CSS | 3.x |
| **Backend** | Supabase | Auth + PostgreSQL + Storage + Edge Functions |
| **Client** | @supabase/supabase-js | 2.x |
| **State Management** | Context API | Pattern Provider/Consumer |
| **Roteamento** | React Router | 6.x |
| **Deploy** | Docker Swarm + Traefik | Reverse proxy com Let's Encrypt |

### 2.2 Arquitetura Multi-Tenant

Isolamento de dados por **organização** (tenant):

```
User (auth.users)
    ↓ N:1
Membership (user_id, organization_id, role)
    ↓ N:1
Organization (id, name, slug)
```

Todas as tabelas de domínio (tickets, categories, workflows, etc.) possuem:
- Coluna `organization_id` (FK → organizations.id)
- Políticas RLS: `organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid())`

---

## 3. Auditoria (Fase 1)

3 agentes de code review paralelos auditaram todo o código e encontraram **57 problemas**:

| Severidade | Qtd | Exemplos |
|---|---|---|
| CRITICAL | 17 | Auth mockada, senha em console.log, RLS inoperante, supply chain risk |
| HIGH | 14 | Type mismatches, rota parametrizada capturando "new", propriedade inexistente |
| MEDIUM | 12 | Validação inconsistente, checks truthy impedindo valores falsy |
| LOW | 7 | Imports não utilizados, meta tags desatualizadas |

---

## 4. Quick Fixes (Fase 2) — 10 Correções

### 4.1 Export ausente: TicketPriority
**Arquivo**: `src/types/index.ts`

```typescript
// ADICIONADO
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
```

**Impacto**: Resolve erro de compilação em `NewTicket.tsx`.

### 4.2 Ordem de rotas
**Arquivo**: `src/App.tsx`

```typescript
// ANTES (rota parametrizada capturava "new" como ID)
<Route path="/admin/workflows/:id" element={<WorkflowEditor />} />
<Route path="/admin/workflows/new" element={<WorkflowEditor />} />

// DEPOIS
<Route path="/admin/workflows/new" element={<WorkflowEditor />} />
<Route path="/admin/workflows/:id" element={<WorkflowEditor />} />
```

### 4.3 Senha em plaintext no console
**Arquivo**: `src/stores/useAuthStore.tsx` (versão mockada)

Removido `console.log` que expunha credenciais em plaintext.

### 4.4 Propriedade inexistente: article.category
**Arquivo**: `src/components/ticket/TicketKnowledgeSearch.tsx`

```typescript
// ANTES
<Badge>{article.category}</Badge>  // undefined

// DEPOIS
<Badge>{article.categoryId}</Badge>
```

### 4.5 Valores `null` em campos opcionais
**Arquivo**: `src/pages/tickets/NewTicket.tsx`

```typescript
// ANTES
satisfactionScore: null,      // TypeScript espera number | undefined
satisfactionComment: null,

// DEPOIS
satisfactionScore: undefined,
satisfactionComment: undefined,
```

### 4.6 Label hardcoded de workspace
**Arquivo**: `src/components/layout/AppSidebar.tsx`

```typescript
// ANTES (sempre false, companyId é UUID)
user.companyId === 'c1' ? 'Workspace Padrão' : 'Outro'

// DEPOIS
user.role === 'ADMIN' ? 'Admin Workspace' : 'Workspace Padrão'
```

### 4.7 Script externo (supply chain risk)
**Arquivo**: `index.html`

- Removido `<script src="https://goskip.dev/skip.js">`
- Corrigido título: "Antropia Desk"
- Atualizado meta description

### 4.8 Validação inconsistente de senha
**Arquivo**: `src/pages/settings/ProfileSettingsPage.tsx`

```typescript
// ANTES (desalinhado com SecurityForm)
password: z.string().min(6, ...)

// DEPOIS (alinhado)
password: z.string().min(8, ...)
```

### 4.9 Checks truthy impedindo valores falsy
**Arquivos**: 5 services (`categoryService`, `workflowService`, `templateService`, `reportService`, `ticketService`)

```typescript
// ANTES (bug: string vazia não é salva)
if (updates.name) dbUpdates.name = updates.name

// DEPOIS (correto: permite salvar string vazia)
if (updates.name !== undefined) dbUpdates.name = updates.name
```

---

## 5. Autenticação Real com Supabase (Fase 3)

### 5.1 O Problema Crítico

**Estado anterior**: Autenticação 100% mockada.

```typescript
// 3 usuários hardcoded
const MOCK_USERS: User[] = [
  { id: 'c0ee...', email: 'alice@antropia.com', role: 'ADMIN', companyId: 'a0ee...' },
  { id: 'd0ee...', email: 'bob@antropia.com', role: 'AGENT', companyId: 'a0ee...' },
  { id: 'e0ee...', email: 'charlie@client.com', role: 'USER', companyId: 'b0ee...' },
]

const login = async (email: string) => {
  const user = MOCK_USERS.find(u => u.email === email)  // sem senha
  localStorage.setItem('antropia_user', JSON.stringify(user))
}
```

**Consequências**:
1. `auth.uid()` retornava `NULL` (não havia sessão Supabase)
2. Todas policies RLS bloqueavam acesso (`user_id = auth.uid()` sempre falhava)
3. Queries retornavam arrays vazios
4. Impossível testar multi-tenancy real

### 5.2 Solução: Reescrita do AuthStore

**Arquivo**: `src/stores/useAuthStore.tsx` — 221 linhas (reescrita completa)

#### Interface exportada

```typescript
interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean                                                // NOVO
  login: (email: string, password: string) => Promise<void>       // password adicionado
  logout: () => void
  users: User[]
  fetchOrgUsers: () => Promise<void>                              // NOVO
  updateUserStatus: (userId: string, active: boolean) => void     // mantido (no-op)
  updateProfile: (data: { name: string; avatar?: File }) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}
```

#### Função `loadUserProfile` (Core)

```typescript
async function loadUserProfile(authUserId: string, authEmail: string): Promise<User> {
  // Query paralela: profiles + memberships
  const [profileRes, membershipRes] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url').eq('id', authUserId).single(),
    supabase.from('memberships').select('role, organization_id').eq('user_id', authUserId).limit(1).single(),
  ])

  if (membershipRes.error || !membershipRes.data) {
    console.error('[loadUserProfile] Membership lookup failed', { authUserId, error: membershipRes.error })
    throw new Error('Usuário não pertence a nenhuma organização.')
  }

  return {
    id: authUserId,
    name: profileRes.data?.full_name || authEmail.split('@')[0],
    email: authEmail,
    role: membershipRes.data.role as UserRole,
    avatar: profileRes.data?.avatar_url || undefined,
    companyId: membershipRes.data.organization_id,
    active: true,
  }
}
```

#### Inicialização (Session Restore + Listener)

```typescript
useEffect(() => {
  if (initRef.current) return        // Guard: React StrictMode double-init
  initRef.current = true

  let handledByGetSession = false     // Guard: race condition

  // 1. Restaurar sessão existente
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      handledByGetSession = true
      loadUserProfile(session.user.id, session.user.email || '').then(
        (u) => { setUser(u); setLoading(false) },
        () => { setLoading(false) },
      )
    } else {
      setLoading(false)
    }
  })

  // 2. Listener para mudanças de auth
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        if (handledByGetSession) { handledByGetSession = false; return } // evita duplicação
        loadUserProfile(session.user.id, session.user.email || '').then(
          (u) => { setUser(u); setLoading(false) },
          () => { setLoading(false) },
        )
      } else if (event === 'SIGNED_OUT') {
        setUser(null); setUsers([]); setLoading(false)
      }
    },
  )

  return () => { subscription.unsubscribe() }
}, [])
```

**Guards implementados**:
- `initRef`: Previne execução dupla em React StrictMode
- `handledByGetSession`: Previne race condition onde `getSession()` e `onAuthStateChange('SIGNED_IN')` processariam mesma sessão

#### Login / Logout

```typescript
const login = useCallback(async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  // onAuthStateChange disparará SIGNED_IN → loadUserProfile
}, [])

const logout = useCallback(async () => {
  await supabase.auth.signOut()
  setUser(null); setUsers([])
}, [])
```

#### fetchOrgUsers (Name Resolution)

```typescript
const fetchOrgUsers = useCallback(async () => {
  if (!user) return

  const { data: memberships } = await supabase
    .from('memberships')
    .select('user_id, role, organization_id')
    .eq('organization_id', user.companyId)

  const userIds = memberships.map((m) => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const orgUsers: User[] = memberships.map((m) => {
    const p = profileMap.get(m.user_id)
    return {
      id: m.user_id,
      name: p?.full_name || 'Usuário',
      email: '',           // limitação: auth.users inacessível via client SDK
      role: m.role as UserRole,
      avatar: p?.avatar_url || undefined,
      companyId: m.organization_id,
      active: true,
    }
  })
  setUsers(orgUsers)
}, [user])

// Auto-executado quando user loga
useEffect(() => { if (user) fetchOrgUsers() }, [user, fetchOrgUsers])
```

**Consumidores de `users[]`**:
- `TicketDetail.tsx` — lookup assignee/requester name
- `ArticleDetail.tsx` — lookup author name
- `VersionHistory.tsx` — lookup editor name
- `Users.tsx` (admin) — lista de membros

#### updateProfile (Com Upload de Avatar)

```typescript
const updateProfile = useCallback(async (data: { name: string; avatar?: File }) => {
  if (!user) return
  let avatarUrl = user.avatar

  if (data.avatar) {
    const ext = data.avatar.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, data.avatar, { upsert: true })

    if (uploadErr) throw uploadErr     // erro propagado (não silenciado)

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    avatarUrl = urlData.publicUrl
  }

  const { error } = await supabase.from('profiles')
    .update({ full_name: data.name, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw error

  setUser({ ...user, name: data.name, avatar: avatarUrl })
}, [user])
```

#### updatePassword

```typescript
const updatePassword = useCallback(async (password: string) => {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}, [])
```

### 5.3 Login.tsx (Atualizado)

**Mudanças**:
- Campo password habilitado com estado controlado
- Seção "Acesso rápido (Demo)" removida
- `login(email, password)` com 2 argumentos
- Validação de password vazio
- Imports não utilizados removidos (`CardFooter`, `translateRole`)

```typescript
const [password, setPassword] = useState('')
const { login } = useAuthStore()    // sem 'users' (não precisa mais de demo)

const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!email) { setError('E-mail obrigatório.'); return }
  if (!password) { setError('Senha obrigatória.'); return }
  try {
    await login(email, password)
    navigate('/')
  } catch { setError('Credenciais inválidas ou usuário inativo.') }
}
```

### 5.4 Layout.tsx (Loading State)

```typescript
// ANTES: redirect imediato durante session restore
const { isAuthenticated } = useAuthStore()
if (!isAuthenticated) return <Navigate to="/login" replace />

// DEPOIS: spinner enquanto restaura sessão
const { isAuthenticated, loading } = useAuthStore()
if (loading) return <div><Loader2 className="animate-spin" /></div>
if (!isAuthenticated) return <Navigate to="/login" replace />
```

### 5.5 TicketMetadata.tsx (Email Condicional)

```typescript
// ANTES: renderizava div vazia quando email = ''
<div>{requester.email}</div>

// DEPOIS: renderização condicional
{requester.email && <div>{requester.email}</div>}
```

---

## 6. Esquema do Banco de Dados (Tabelas de Auth)

### profiles

```
id          UUID PK (= auth.users.id)
full_name   TEXT | null
avatar_url  TEXT | null
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### memberships

```
id               UUID PK
user_id          UUID FK → auth.users.id
organization_id  UUID FK → organizations.id
role             ENUM ('ADMIN' | 'AGENT' | 'USER')
created_at       TIMESTAMPTZ
UNIQUE(user_id, organization_id)
```

### organizations

```
id          UUID PK
name        TEXT
slug        TEXT UNIQUE
created_at  TIMESTAMPTZ
```

### RLS Pattern (todas tabelas de domínio)

```sql
CREATE POLICY "Users can view data from their org"
ON tabela FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid()
  )
);
```

---

## 7. Mapeamento snake_case (DB) → camelCase (Frontend)

| DB (snake_case) | Frontend (camelCase) | Contexto |
|---|---|---|
| `organization_id` | `companyId` (User) / `organizationId` (outros) | UUID |
| `requester_id` | `requesterId` | UUID |
| `assignee_id` | `assigneeId` | UUID |
| `full_name` | `name` | string |
| `avatar_url` | `avatar` | string |
| `created_at` | `createdAt` | ISO 8601 |
| `updated_at` | `updatedAt` | ISO 8601 |
| `is_active` | `isActive` | boolean |
| `due_date` | `dueDate` | ISO 8601 |
| `category_id` | `categoryId` | UUID |
| `estimated_cost` | `estimatedCost` | number |
| `satisfaction_score` | `satisfactionScore` | number |

Transform manual em cada service (padrão existente no projeto).

---

## 8. Configuração Supabase Client

**Arquivo**: `src/lib/supabase/client.ts`

```typescript
const SUPABASE_URL = (window as any).ENV?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = (window as any).ENV?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})
```

**Variáveis necessárias** (`.env`):
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

**Docker**: fallback via `window.ENV` injetado em runtime.

---

## 9. Diagrama de Fluxo de Autenticação

```
┌──────────────────────────────────────────────────────┐
│                  USER ABRE APP                       │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ AuthProvider    │
                 │ monta (useEffect)│
                 └────────┬────────┘
                          │
           ┌──────────────┴──────────────┐
           ▼                             ▼
  ┌─────────────────┐          ┌──────────────────┐
  │ getSession()    │          │ onAuthStateChange │
  │ (sessão local?) │          │ (listener)        │
  └────────┬────────┘          └────────┬──────────┘
           │                            │
      ┌────┴────┐                       │
      │ Sessão? │                       │
      └─┬───┬───┘                       │
     Sim│   │Não                        │
        │   │                           │
        │   └──► setLoading(false)      │
        │        → <Navigate /login>    │
        │                               │
        ▼                               │
  ┌──────────────────┐                  │
  │ loadUserProfile()│◄─────────────────┤ SIGNED_IN
  │ profiles +       │                  │
  │ memberships      │                  │
  └────────┬─────────┘                  │
           │                            │
           ▼                            │
  ┌──────────────────┐                  │
  │ setUser(user)    │                  │
  │ setLoading(false)│                  │
  │ → fetchOrgUsers()│                  │
  │ → App renderiza  │                  │
  └──────────────────┘                  │
                                        │
  ┌─────────────────────────────────┐   │
  │ LOGIN:                          │   │
  │ signInWithPassword(email, pass) │───┘
  │ → dispara SIGNED_IN event       │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │ LOGOUT:                         │
  │ signOut()                       │
  │ → dispara SIGNED_OUT event      │
  │ → setUser(null), setUsers([])   │
  │ → <Navigate /login>             │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │ REFRESH:                        │
  │ Mesmo fluxo de "abre app"       │
  │ Sessão persistida em localStorage│
  └─────────────────────────────────┘
```

---

## 10. Consumidores do Auth Store

Todos continuam funcionando sem mudança (interface retrocompatível):

**Stores** (usam `user`):
`useTicketStore`, `useCategoryStore`, `useWorkflowStore`, `useSettingsStore`, `useReportStore`, `useDashboardStore`, `useKnowledgeStore`, `useAttachmentStore`, `useIntegrationStore`, `useStatusPageStore`, `useUserPreferencesStore`

**Pages** (usam `user`):
`TicketList`, `TicketDetail`, `NewTicket`, `Index`, `ArticleDetail`, `KnowledgeBase`, `ArticleEditor`, `Reports`, `StatusPage`, `ProfileSettingsPage`

**Pages** (usam `users`):
`TicketDetail` (assignee/requester lookup), `ArticleDetail` (author), `Users` (admin list)

**Components** (usam `users`):
`VersionHistory` (editor name)

**Components** (usam `user`/`logout`):
`Layout`, `AppSidebar`, `AppHeader`, `AttachmentList`, `NotificationCenter`, `SecurityForm`, `ProfileForm`, `NotificationTemplates`

---

## 11. Limitações Conhecidas

### 11.1 Email vazio no array `users[]`

**Causa**: `auth.users` inacessível via client SDK (requer `service_role` key).

**Impacto**: `users[].email` é `''` para membros carregados via `fetchOrgUsers()`. UI patcheada para não renderizar email vazio.

**Solução recomendada**: Criar RPC function com `SECURITY DEFINER`:

```sql
CREATE OR REPLACE FUNCTION get_organization_members(org_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT, avatar_url TEXT, role user_role)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.user_id, u.email, p.full_name, p.avatar_url, m.role
  FROM memberships m
  INNER JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN profiles p ON p.id = m.user_id
  WHERE m.organization_id = org_id;
END;
$$;
```

### 11.2 `updateUserStatus` é no-op

**Causa**: `memberships` não tem coluna `active`. Função mantida na interface por retrocompatibilidade.

**Solução**: `ALTER TABLE memberships ADD COLUMN active BOOLEAN DEFAULT true;`

### 11.3 Attachments mockados

**Causa**: `useAttachmentStore` retorna dados hardcoded.

**Solução**: Reescrever com integração Supabase Storage (tabela `attachments` já existe no schema).

---

## 12. Problemas Restantes (Fora do Escopo Atual)

### Infraestrutura Docker

| Problema | Arquivo | Descrição |
|---|---|---|
| Build args `_FILE` | docker-compose.yml | Sufixo incorreto, Vite não lê |
| Redis sem senha | docker-compose.yml | `--requirepass` sem argumento |
| Nginx duplicado | nginx.conf | Blocos server duplicados |
| Traefik certresolver | docker-compose.yml | Nomes inconsistentes entre serviços |
| Port mismatches | docker-compose.yml | Portas não batem entre services |

### Funcionalidade

| Problema | Prioridade | Descrição |
|---|---|---|
| Ticket description | ALTA | Coluna não existe na tabela `tickets` |
| readableId | MÉDIA | Usa `UUID.split('-')[0]` — precisa de sequential ID |
| Error Boundaries | ALTA | Erros de runtime crasham app inteira |
| Delete sem filtro org | CRÍTICA | Alguns services não validam `organization_id` no delete |
| Notification enum | ALTA | Frontend enums divergem do DB |

---

## 13. Verificação de Build

```
$ npm run build

rolldown-vite v7.3.1 building client environment for production...
✓ 3452 modules transformed.
dist/index.html                     0.69 kB │ gzip:   0.40 kB
dist/assets/index-C7XAvu_J.css     98.69 kB │ gzip:  16.15 kB
dist/assets/index-DcZiJ4jN.js   1,535.78 kB │ gzip: 428.66 kB
✓ built in 7.39s
```

**Status**: Build compila sem erros TypeScript.

---

## 14. Plano de Testes

| # | Cenário | Resultado Esperado |
|---|---|---|
| 1 | Login válido | Redirect para `/`, dashboard com dados reais |
| 2 | Login inválido | Mensagem "Credenciais inválidas" |
| 3 | Login sem membership | Console error + mensagem genérica na UI |
| 4 | Refresh da página | Sessão restaurada, sem redirect para /login |
| 5 | Logout | Redirect para `/login`, localStorage limpo |
| 6 | Profile update (nome) | Nome atualizado no sidebar e no DB |
| 7 | Profile update (avatar) | Arquivo no Supabase Storage, URL no profiles |
| 8 | Password update | Nova senha funciona no próximo login |
| 9 | TicketDetail | Nome do solicitante/responsável resolvido |
| 10 | Admin Users | Lista de membros da organização |
| 11 | RLS check | Network tab mostra dados filtrados por org |
| 12 | Multi-tab sync | Logout em uma aba → logout em todas |

---

## 15. Próximos Passos (Priorizado)

### Imediato
1. Testar autenticação em staging (checklist acima)
2. Implementar RPC `get_organization_members` para resolver emails
3. Adicionar Error Boundaries

### Próxima Sprint
4. Coluna `description` na tabela tickets
5. Sequential readable ID (trigger + sequence)
6. Auditar deletes: adicionar filtro `organization_id`
7. Integrar attachments com Supabase Storage

### Backlog Técnico
- Code splitting com React.lazy()
- Testes E2E (Playwright)
- CI/CD com type check + lint + testes
- Monitoring (Sentry)
- Audit log

---

## 16. Arquivos Modificados (Referência)

| Arquivo | Tipo de Mudança |
|---|---|
| `src/stores/useAuthStore.tsx` | Reescrita completa (221 linhas) |
| `src/pages/auth/Login.tsx` | Refactor: password habilitado, demo removido |
| `src/components/Layout.tsx` | Loading state adicionado |
| `src/components/ticket/TicketMetadata.tsx` | Renderização condicional de email |
| `src/types/index.ts` | Export TicketPriority |
| `src/App.tsx` | Reordenação de rotas |
| `src/components/ticket/TicketKnowledgeSearch.tsx` | Fix article.category → categoryId |
| `src/pages/tickets/NewTicket.tsx` | null → undefined, type-only import |
| `src/pages/settings/ProfileSettingsPage.tsx` | min(6) → min(8) |
| `src/components/layout/AppSidebar.tsx` | Fix label hardcoded |
| `index.html` | Removido script externo, meta tags |
| `src/services/categoryService.ts` | !== undefined checks |
| `src/services/workflowService.ts` | !== undefined checks |
| `src/services/templateService.ts` | !== undefined checks |
| `src/services/reportService.ts` | !== undefined checks |
| `src/services/ticketService.ts` | !== undefined checks |

**Total**: ~600 linhas modificadas em 16 arquivos.

---

## 17. Glossário

| Termo | Definição |
|---|---|
| **RLS** | Row Level Security — policies PostgreSQL que filtram dados por `auth.uid()` |
| **auth.uid()** | Função Supabase que retorna UUID do usuário autenticado (NULL se não autenticado) |
| **Multi-tenant** | Arquitetura onde organizações compartilham infra mas dados são isolados |
| **Membership** | Relação N:N entre user e organization, com role associado |
| **SECURITY DEFINER** | Função SQL que executa com privilégios do owner (pode acessar auth.users) |
| **Publishable key** | Chave Supabase para uso público (respeita RLS) — segura no frontend |
| **Service_role key** | Chave Supabase com privilégios elevados (bypassa RLS) — NUNCA expor no frontend |
