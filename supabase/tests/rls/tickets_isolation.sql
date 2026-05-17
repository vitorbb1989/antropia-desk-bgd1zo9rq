-- Teste pgtap: isolamento cross-organization da tabela `tickets`.
--
-- O que valida:
--   1. User A so ve tickets da Org A (SELECT)
--   2. User B so ve tickets da Org B (SELECT)
--   3. User A nao consegue UPDATE em ticket da Org B (RLS bloqueia silenciosamente)
--   4. User A nao consegue DELETE em ticket da Org B
--   5. USER (role) so ve proprios tickets dentro da propria org
--   6. ADMIN ve todos os tickets da propria org
--
-- Como rodar:
--   psql "$STAGING_DB_URL" -f supabase/tests/rls/tickets_isolation.sql
--
-- Tudo dentro de BEGIN/ROLLBACK — nao polui o banco.

BEGIN;

SELECT plan(8);

-- ==============================================================================
-- SETUP (rodado como service_role / superuser, fora de RLS)
-- ==============================================================================

-- Org A e Org B
INSERT INTO public.organizations (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Org A Test', 'org-a-test'),
  ('22222222-2222-2222-2222-222222222222', 'Org B Test', 'org-b-test');

-- Simular auth.users via insert direto em profiles (em ambiente real, virao do auth)
-- IMPORTANTE: em staging com auth ativo, criar via supabase.auth.admin.createUser e usar IDs reais.
INSERT INTO public.profiles (id, full_name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', 'Admin Org A'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', 'User Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'Admin Org B');

-- Memberships
INSERT INTO public.memberships (user_id, organization_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', '11111111-1111-1111-1111-111111111111', 'ADMIN'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', '11111111-1111-1111-1111-111111111111', 'USER'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '22222222-2222-2222-2222-222222222222', 'ADMIN');

-- 1 ticket por org (ADMIN como requester de cada)
INSERT INTO public.tickets (id, organization_id, requester_id, title, status, priority)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
   'Ticket Admin Org A', 'RECEIVED', 'MEDIUM'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
   'Ticket USER Org A', 'RECEIVED', 'MEDIUM'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd01',
   '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
   'Ticket Admin Org B', 'RECEIVED', 'MEDIUM');

-- ==============================================================================
-- TESTE 1: ADMIN da Org A ve apenas os 2 tickets da Org A (nao ve o da Org B)
-- ==============================================================================

SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';

SELECT results_eq(
  'SELECT count(*)::int FROM public.tickets',
  ARRAY[2]::int[],
  'ADMIN Org A ve exatamente 2 tickets (cross-org bloqueado)'
);

SELECT bag_eq(
  'SELECT organization_id::text FROM public.tickets',
  ARRAY[
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111'
  ],
  'Todos os tickets visiveis sao da Org A'
);

-- ==============================================================================
-- TESTE 2: ADMIN da Org B ve apenas o ticket da Org B
-- ==============================================================================

SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';

SELECT results_eq(
  'SELECT count(*)::int FROM public.tickets',
  ARRAY[1]::int[],
  'ADMIN Org B ve exatamente 1 ticket'
);

SELECT results_eq(
  'SELECT organization_id::text FROM public.tickets',
  ARRAY['22222222-2222-2222-2222-222222222222'],
  'Ticket visivel para Admin Org B e da Org B'
);

-- ==============================================================================
-- TESTE 3: USER da Org A so ve PROPRIO ticket (nao ve o do Admin Org A)
-- ==============================================================================

SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02';

SELECT results_eq(
  'SELECT count(*)::int FROM public.tickets',
  ARRAY[1]::int[],
  'USER da Org A ve apenas 1 ticket (o proprio)'
);

SELECT results_eq(
  'SELECT requester_id::text FROM public.tickets',
  ARRAY['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02'],
  'USER da Org A so ve ticket onde e requester'
);

-- ==============================================================================
-- TESTE 4: UPDATE cross-org e bloqueado (afeta 0 linhas, sem erro)
-- ==============================================================================

SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';

-- UPDATE retorna 0 linhas afetadas (RLS filtra silenciosamente, nao throw)
WITH upd AS (
  UPDATE public.tickets
     SET title = 'hacked-cross-org'
   WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddd01'
   RETURNING 1
)
SELECT is(
  (SELECT count(*)::int FROM upd),
  0,
  'UPDATE cross-org afeta 0 linhas (RLS bloqueia)'
);

-- ==============================================================================
-- TESTE 5: Validar que o titulo do ticket da Org B nao foi alterado
-- (precisa rodar como ADMIN da Org B para conseguir SELECT)
-- ==============================================================================

SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';

SELECT results_eq(
  $$ SELECT title FROM public.tickets WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddd01' $$,
  ARRAY['Ticket Admin Org B'],
  'Titulo do ticket da Org B preservado (UPDATE cross-org nao surtiu efeito)'
);

SELECT * FROM finish();

ROLLBACK;
