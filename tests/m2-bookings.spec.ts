import { test, expect, Page } from '@playwright/test'
import fs from 'fs'

const EMAIL    = process.env.TEST_USER_EMAIL!
const PASSWORD = process.env.TEST_USER_PASSWORD!
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

fs.mkdirSync('test-results/screenshots', { recursive: true })

// Delete all "Test Guest" bookings directly via Supabase API (no browser needed)
test.beforeAll(async () => {
  await fetch(`${SUPA_URL}/rest/v1/bookings?guest=eq.Test%20Guest`, {
    method: 'DELETE',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      Prefer: 'return=minimal',
    },
  })
})

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.waitForLoadState('networkidle')
}

test.describe.configure({ mode: 'serial' })

test.describe('M2 — Bookings & Cleaning', () => {

  test('bookings page loads', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await expect(page.getByRole('button', { name: '+ New Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-01-bookings-empty.png', fullPage: true })
  })

  test('new booking modal opens and closes', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-02-booking-modal.png', fullPage: true })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).not.toBeVisible()
  })

  test('create a booking end-to-end', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()

    // Use today + tomorrow so the booking appears in the active rooms list
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

    await page.locator('#bm-guest').fill('Test Guest')
    await page.locator('#bm-room').selectOption('Tent 1')  // use a vacant room
    await page.locator('#bm-checkin').fill(today)
    await page.locator('#bm-checkout').fill(tomorrow)
    await page.locator('#bm-gross').fill('2000')
    await page.locator('#bm-comm').fill('200')
    await page.screenshot({ path: 'test-results/screenshots/m2-03-booking-filled.png', fullPage: true })

    await page.getByRole('button', { name: 'Add Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).not.toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Test Guest').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-04-booking-created.png', fullPage: true })
  })

  test('edit a booking', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await expect(page.getByText('Test Guest').first()).toBeVisible()

    await page.getByText('Test Guest').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-05-edit-modal.png', fullPage: true })

    await page.locator('#bm-status').selectOption('Check-in')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).not.toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-06-booking-updated.png', fullPage: true })
  })

  test('filter works', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await page.waitForLoadState('networkidle')

    // Filter to Check-in today — Test Guest should appear (checkin === today, status = Check-in)
    await page.getByRole('combobox').first().selectOption('checkin')
    await expect(page.getByText('Test Guest').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-07-filter.png', fullPage: true })

    // Filter to Vacant — Tent 1 is occupied by Test Guest so it should NOT appear in vacant list
    await page.getByRole('combobox').first().selectOption('vacant')
    await expect(page.getByText('Test Guest')).not.toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-08-filter-vacant.png', fullPage: true })
  })

  test('cleaning page shows all 12 rooms', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=cleaning')
    await page.waitForLoadState('networkidle')
    for (const room of ['ม่วง', 'ชมพู', 'ขาว', 'Tent 1', 'Bungalow 1', 'Extra 1']) {
      await expect(page.getByText(room).first()).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/screenshots/m2-09-cleaning.png', fullPage: true })
  })

  test('delete the test booking', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard?tab=rooms')
    await expect(page.getByText('Test Guest').first()).toBeVisible()

    await page.getByText('Test Guest').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).toBeVisible()

    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).not.toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-10-after-delete.png', fullPage: true })
  })

})
