import { test, expect, Page } from '@playwright/test'
import fs from 'fs'

const EMAIL    = process.env.TEST_USER_EMAIL!
const PASSWORD = process.env.TEST_USER_PASSWORD!
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

fs.mkdirSync('test-results/screenshots', { recursive: true })

// Clean up Ling Cheng test bookings before and after
async function deleteTestBookings() {
  await fetch(`${SUPA_URL}/rest/v1/bookings?guest=eq.Ling%20Cheng`, {
    method: 'DELETE',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: 'return=minimal' },
  })
}

test.beforeAll(async () => { await deleteTestBookings() })
test.afterAll(async () => { await deleteTestBookings() })

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.waitForLoadState('networkidle')
}

test.describe.configure({ mode: 'serial' })

test.describe('M5 — Multi-room booking (Ling Cheng)', () => {

  test('OTA screenshot auto-fills 2-unit booking', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()

    const screenshotPath = 'tests/fixtures/ling-cheng-booking.png'
    if (!fs.existsSync(screenshotPath)) {
      console.log(`[skip] Fixture not found: ${screenshotPath}`)
      test.skip()
      return
    }

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Choose image').click(),
    ])
    await fileChooser.setFiles(screenshotPath)
    console.log('[ui] Screenshot uploaded, waiting for auto-fill…')
    await page.waitForTimeout(5000)

    const guest  = await page.locator('#bm-guest').inputValue()
    const gross  = await page.locator('#bm-gross').inputValue()
    const comm   = await page.locator('#bm-comm').inputValue()
    console.log(`[ui] Guest: ${guest}`)
    console.log(`[ui] Gross: ${gross}`)
    console.log(`[ui] Commission: ${comm}`)

    await page.screenshot({ path: 'test-results/screenshots/m5-01-autofill.png', fullPage: true })

    // Room 2 selector should appear
    const room2 = page.locator('#bm-room-2')
    await expect(room2).toBeVisible()
    console.log('[ui] ✓ Room 2 selector appeared')

    await page.screenshot({ path: 'test-results/screenshots/m5-02-two-rooms.png', fullPage: true })
  })

  test('can manually add two rooms and create split bookings', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()

    // Fill manually
    const today = new Date().toISOString().slice(0, 10)
    const inTwoDays = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)

    await page.locator('#bm-guest').fill('Ling Cheng')
    await page.locator('#bm-room').selectOption('Bungalow 1')
    await page.locator('#bm-checkin').fill(today)
    await page.locator('#bm-checkout').fill(inTwoDays)
    await page.locator('#bm-gross').fill('1739.91')
    await page.locator('#bm-comm').fill('409.47')
    await page.locator('#bm-source').selectOption('Booking.com')

    // Add second room
    await page.getByRole('button', { name: '+ Add another room' }).click()
    await expect(page.locator('#bm-room-2')).toBeVisible()
    await page.locator('#bm-room-2').selectOption('Bungalow 2')

    await page.screenshot({ path: 'test-results/screenshots/m5-03-two-rooms-filled.png', fullPage: true })

    // Split info text should be visible
    await expect(page.getByText('split equally across 2 rooms')).toBeVisible()

    // Save
    await page.getByRole('button', { name: 'Add Booking' }).click()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/screenshots/m5-04-after-save.png', fullPage: true })

    // Modal should have closed (booking saved)
    await expect(page.getByRole('heading', { name: 'New Booking' })).not.toBeVisible()
    console.log('[ui] ✓ Modal closed — bookings saved')

    // Go to Income & OTA tab — current month should already be selected
    await page.goto('/dashboard?tab=income')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    const rows = page.getByText('Ling Cheng')
    const count = await rows.count()
    console.log(`[ui] Ling Cheng rows in Income tab (April 2026): ${count}`)
    expect(count).toBe(2)
    await page.screenshot({ path: 'test-results/screenshots/m5-05-income-two-rows.png', fullPage: true })
    console.log('[ui] ✓ 2 Ling Cheng rows found — split booking works')
  })

  test('Income & OTA edit icon opens booking modal', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=income')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Edit icon should be present
    const editBtn = page.getByTitle('Edit booking').first()
    await expect(editBtn).toBeVisible()
    await editBtn.click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m5-06-income-edit.png', fullPage: true })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).not.toBeVisible()
    console.log('[ui] ✓ Edit icon opens and closes booking modal')
  })

})
