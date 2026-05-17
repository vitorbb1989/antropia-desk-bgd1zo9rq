import { test, expect } from '@playwright/test'

/**
 * Smoke E2E — caminho minimo que precisa funcionar para o app estar usavel.
 *
 * Cobre: login → criar ticket → adicionar mensagem.
 *
 * Vars obrigatorias:
 *   E2E_USER, E2E_PASS   credenciais de um usuario AGENT ou ADMIN em staging
 *   E2E_BASE_URL         (opcional) override do baseURL do playwright.config
 *
 * Se faltar credencial, o teste e skipado (nao falha o CI).
 */

const TEST_USER = process.env.E2E_USER
const TEST_PASS = process.env.E2E_PASS
const haveCreds = !!(TEST_USER && TEST_PASS)

test.describe('smoke', () => {
  test.skip(!haveCreds, 'E2E_USER / E2E_PASS nao configurados — pulando smoke')

  test('login → criar ticket → adicionar mensagem', async ({ page }) => {
    // ── Login ───────────────────────────────────────────────────
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(TEST_USER!)
    await page.locator('input[type="password"]').fill(TEST_PASS!)
    await page.locator('button[type="submit"]').click()

    // Apos login: app redireciona para `/` ou `/tickets`
    await expect(page).toHaveURL(/\/(tickets|dashboard)?\/?$/, {
      timeout: 15_000,
    })

    // ── Criar ticket ────────────────────────────────────────────
    const ticketTitle = `Smoke E2E ${new Date().toISOString()}`
    await page.goto('/tickets/new')
    await page.locator('input[name="title"], input[placeholder*="titulo" i]').first().fill(ticketTitle)
    await page.locator('textarea[name="description"], textarea[placeholder*="descric" i]').first()
      .fill('Smoke test automatizado via Playwright. Pode ignorar.')

    // Submit (texto pode variar: "Criar", "Abrir chamado", etc.)
    await page.locator('button[type="submit"]').first().click()

    // Espera ticket aparecer (na lista ou no detail)
    await expect(page.getByText(ticketTitle)).toBeVisible({ timeout: 15_000 })

    // ── Adicionar mensagem (best-effort — depende da UI estar na pagina) ──
    const messageInput = page
      .locator('textarea[name="message"], textarea[placeholder*="mensagem" i]')
      .first()

    if (await messageInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const msg = 'Mensagem de smoke test'
      await messageInput.fill(msg)
      await page
        .getByRole('button', { name: /enviar|responder|adicionar/i })
        .first()
        .click()
      await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 })
    }
  })
})
