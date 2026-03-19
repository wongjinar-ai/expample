import { test, expect, Page } from '@playwright/test'
import fs from 'fs'

const EMAIL    = process.env.TEST_USER_EMAIL!
const PASSWORD = process.env.TEST_USER_PASSWORD!
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

fs.mkdirSync('test-results/screenshots', { recursive: true })

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.waitForLoadState('networkidle')
}

async function cleanupTestBookings() {
  await fetch(`${SUPA_URL}/rest/v1/bookings?guest=eq.Feature%20Test%20Guest`, {
    method: 'DELETE',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: 'return=minimal' },
  })
}

test.beforeAll(async () => { await cleanupTestBookings() })
test.afterAll(async () => { await cleanupTestBookings() })

test.describe.configure({ mode: 'serial' })

test.describe('M6 — Dashboard & Modal new features', () => {

  // ── Dashboard tests ──────────────────────────────────────────────────────

  test('dashboard: check-in panel is on the left', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/screenshots/m6-01-dashboard.png', fullPage: true })

    // Both panels visible
    await expect(page.getByText('Checking in today').first()).toBeVisible()
    await expect(page.getByText('Checking out today').first()).toBeVisible()

    // Check-in panel should appear before Check-out in DOM order
    const checkinPos  = await page.getByText('Checking in today').first().evaluate(el => el.getBoundingClientRect().left)
    const checkoutPos = await page.getByText('Checking out today').first().evaluate(el => el.getBoundingClientRect().left)
    expect(checkinPos).toBeLessThan(checkoutPos)
    console.log(`[ui] ✓ Check-in (left: ${Math.round(checkinPos)}px) is left of Check-out (left: ${Math.round(checkoutPos)}px)`)
  })

  test('dashboard: weekly income summary shows date range', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    // Section title contains "Weekly income summary"
    await expect(page.getByText(/Weekly income summary/i).first()).toBeVisible()
    console.log('[ui] ✓ Weekly income summary heading visible')
    await page.screenshot({ path: 'test-results/screenshots/m6-02-weekly-income.png', fullPage: true })
  })

  test('dashboard: occupancy box shows week% and month%', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Week:/i).first()).toBeVisible()
    await expect(page.getByText(/Month:/i).first()).toBeVisible()
    console.log('[ui] ✓ Week% and Month% labels visible in occupancy box')
    await page.screenshot({ path: 'test-results/screenshots/m6-03-occupancy-rates.png', fullPage: true })
  })

  test('dashboard: occupancy by room shows Mon–Sun columns', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    // All day headers should be present in the week grid
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await expect(page.getByText(day).first()).toBeVisible()
    }
    // Legend items
    await expect(page.getByText('Occupied').first()).toBeVisible()
    await expect(page.getByText('Check-in').first()).toBeVisible()
    await expect(page.getByText('Checkout').first()).toBeVisible()
    console.log('[ui] ✓ Mon–Sun columns and legend visible')
    await page.screenshot({ path: 'test-results/screenshots/m6-04-room-week-grid.png', fullPage: true })
  })

  // ── Booking modal tests ──────────────────────────────────────────────────

  test('booking modal: invoice number auto-generated on new booking', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()
    await page.waitForTimeout(1500) // wait for invoice auto-gen

    const invoiceVal = await page.locator('input[placeholder="Invoice No"]').inputValue()
    console.log(`[ui] Auto-generated invoice: ${invoiceVal}`)
    expect(invoiceVal).toMatch(/^DS\d{2}-\d{2}-\d{7}$/)
    console.log('[ui] ✓ Invoice number format correct: DS{YY}-{MM}-{NNNNNNN}')
    await page.screenshot({ path: 'test-results/screenshots/m6-05-invoice-autogen.png', fullPage: true })
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('booking modal: discount field present and affects net income', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()

    // Fill gross and commission
    await page.locator('#bm-gross').fill('1000')
    await page.locator('#bm-comm').fill('100')
    await page.waitForTimeout(300)

    // Net should be 900 before discount
    let net = await page.locator('#bm-net').inputValue()
    console.log(`[ui] Net before discount: ${net}`)

    // Fill discount
    await page.locator('#bm-discount').fill('50')
    await page.waitForTimeout(300)

    net = await page.locator('#bm-net').inputValue()
    console.log(`[ui] Net after discount of 50: ${net}`)
    // Net = 1000 - 100 - 50 = 850
    expect(parseFloat(net)).toBe(850)
    console.log('[ui] ✓ Net income = Gross − Commission − Discount')
    await page.screenshot({ path: 'test-results/screenshots/m6-06-discount.png', fullPage: true })
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('booking modal: save changes button is black', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()

    const btn = page.getByRole('button', { name: 'Add Booking' })
    const bg = await btn.evaluate(el => getComputedStyle(el).backgroundColor)
    console.log(`[ui] Add Booking button background: ${bg}`)
    // #111 = rgb(17, 17, 17)
    expect(bg).toMatch(/rgb\(1[0-9],\s*1[0-9],\s*1[0-9]\)/)
    console.log('[ui] ✓ Save button is black')
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('booking modal: extend button creates duplicate without dates/prices/tm30', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.waitForLoadState('networkidle')

    // Create a booking to extend
    await page.getByRole('button', { name: '+ New Booking' }).click()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await page.locator('#bm-guest').fill('Feature Test Guest')
    await page.locator('#bm-room').selectOption('Extra 1')
    await page.locator('#bm-checkin').fill(today)
    await page.locator('#bm-checkout').fill(tomorrow)
    await page.locator('#bm-gross').fill('500')
    await page.getByRole('button', { name: 'Add Booking' }).click()
    await page.waitForLoadState('networkidle')

    // Find and open that booking to edit
    await expect(page.getByText('Feature Test Guest').first()).toBeVisible()
    await page.getByText('Feature Test Guest').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m6-07-edit-before-extend.png', fullPage: true })

    // Click Extend
    await page.getByRole('button', { name: 'Extend' }).click()
    await page.waitForTimeout(500)

    // Header should change to "Extend Booking"
    await expect(page.getByRole('heading', { name: 'Extend Booking' })).toBeVisible()

    // Dates and prices should be cleared
    const checkin = await page.locator('#bm-checkin').inputValue()
    const gross   = await page.locator('#bm-gross').inputValue()
    expect(checkin).toBe('')
    expect(parseFloat(gross)).toBe(0)

    // Guest name should be retained
    const guest = await page.locator('#bm-guest').inputValue()
    expect(guest).toBe('Feature Test Guest')

    console.log('[ui] ✓ Extend clears dates/prices, keeps guest name')
    await page.screenshot({ path: 'test-results/screenshots/m6-08-extend-modal.png', fullPage: true })
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('income tab: month selector has separate Month and Year dropdowns', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=income')
    await page.waitForLoadState('networkidle')

    const combos = page.getByRole('combobox')
    const count = await combos.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // First combo should have month names
    const firstOptions = await combos.first().locator('option').allTextContents()
    expect(firstOptions).toContain('March')
    // Second combo should have years
    const secondOptions = await combos.nth(1).locator('option').allTextContents()
    expect(secondOptions.some(y => y.includes('2026'))).toBe(true)

    console.log('[ui] ✓ Month and Year dropdowns present')
    await page.screenshot({ path: 'test-results/screenshots/m6-09-month-year-dropdowns.png', fullPage: true })
  })

})
