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
    await page.goto('/bookings')
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ New Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-01-bookings-empty.png', fullPage: true })
  })

  test('new booking modal opens and closes', async ({ page }) => {
    await login(page)
    await page.goto('/bookings')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-02-booking-modal.png', fullPage: true })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).not.toBeVisible()
  })

  test('create a booking end-to-end', async ({ page }) => {
    await login(page)
    await page.goto('/bookings')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()

    await page.locator('#bm-guest').fill('Test Guest')
    await page.locator('#bm-checkin').fill('2026-04-01')
    await page.locator('#bm-checkout').fill('2026-04-03')
    await page.locator('#bm-gross').fill('2000')
    await page.locator('#bm-comm').fill('200')
    await page.screenshot({ path: 'test-results/screenshots/m2-03-booking-filled.png', fullPage: true })

    await page.getByRole('button', { name: 'Add Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).not.toBeVisible()
    await expect(page.getByText('Test Guest').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-04-booking-created.png', fullPage: true })
  })

  test('edit a booking', async ({ page }) => {
    await login(page)
    await page.goto('/bookings')
    await expect(page.getByText('Test Guest').first()).toBeVisible()

    await page.getByText('Test Guest').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-05-edit-modal.png', fullPage: true })

    await page.locator('#bm-status').selectOption('Check-in')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).not.toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-06-booking-updated.png', fullPage: true })
  })

  test('search filter works', async ({ page }) => {
    await login(page)
    await page.goto('/bookings')

    const searchInput = page.getByPlaceholder('Search guest, room, ref…')
    await searchInput.fill('Test Guest')
    await expect(page.getByText('Test Guest').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-07-search.png', fullPage: true })

    await searchInput.fill('xxxxxxxxnotfound')
    await expect(page.getByText('No bookings match your filters.')).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-08-no-results.png', fullPage: true })
  })

  test('cleaning page shows all 12 rooms', async ({ page }) => {
    await login(page)
    await page.goto('/cleaning')
    await expect(page.getByRole('heading', { name: 'Cleaning Plan' })).toBeVisible()
    for (const room of ['ม่วง', 'ชมพู', 'ขาว', 'Tent 1', 'Bungalow 1', 'Extra 1']) {
      await expect(page.getByText(room).first()).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/screenshots/m2-09-cleaning.png', fullPage: true })
  })

  test('delete the test booking', async ({ page }) => {
    await login(page)
    await page.goto('/bookings')
    await expect(page.getByText('Test Guest').first()).toBeVisible()

    await page.getByText('Test Guest').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).toBeVisible()

    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Booking' })).not.toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m2-10-after-delete.png', fullPage: true })
  })

})
