import { test, expect, Page } from '@playwright/test'
import fs from 'fs'

const EMAIL    = process.env.TEST_USER_EMAIL!
const PASSWORD = process.env.TEST_USER_PASSWORD!

fs.mkdirSync('test-results/screenshots', { recursive: true })

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.waitForLoadState('networkidle')
}

test.describe.configure({ mode: 'serial' })

test.describe('M3 — Dashboard, Day Guest & Shifts', () => {

  test('dashboard loads with metric cards', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    // Metric cards section
    await expect(page.getByText('Occupancy').first()).toBeVisible()
    await expect(page.getByText('Check-ins').first()).toBeVisible()
    await expect(page.getByText('Checkouts').first()).toBeVisible()
    await expect(page.getByText('Gross').first()).toBeVisible()
    await expect(page.getByText('Net').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m3-01-dashboard.png', fullPage: true })
  })

  test('dashboard weekly grid shows all OCC_ROOMS', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    // Verify all 10 OCC_ROOMS appear in weekly grid
    for (const room of ['ม่วง', 'ชมพู', 'ขาว', 'Tent 1', 'Tent 2', 'Tent 3', 'Tent 4', 'Bungalow 1', 'Bungalow 2', 'Bungalow 3']) {
      await expect(page.getByText(room).first()).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/screenshots/m3-02-weekly-grid.png', fullPage: true })
  })

  test('day guest page loads with room × date grid', async ({ page }) => {
    await login(page)
    await page.goto('/day-guest')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Day Guest' })).toBeVisible()
    // All 12 rooms should appear
    for (const room of ['ม่วง', 'ชมพู', 'Tent 1', 'Bungalow 1', 'Extra 1']) {
      await expect(page.getByText(room).first()).toBeVisible()
    }
    // Date navigation buttons
    await expect(page.getByRole('button', { name: '‹' })).toBeVisible()
    await expect(page.getByRole('button', { name: '›' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m3-03-day-guest.png', fullPage: true })
  })

  test('day guest date navigation works', async ({ page }) => {
    await login(page)
    await page.goto('/day-guest')
    await page.waitForLoadState('networkidle')

    // Click next week
    await page.getByRole('button', { name: '›' }).click()
    await page.screenshot({ path: 'test-results/screenshots/m3-04-day-guest-next.png', fullPage: true })

    // Click previous week to go back
    await page.getByRole('button', { name: '‹' }).click()
    await page.screenshot({ path: 'test-results/screenshots/m3-05-day-guest-prev.png', fullPage: true })
  })

  test('shifts page loads', async ({ page }) => {
    await login(page)
    await page.goto('/shifts')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Shifts' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m3-06-shifts.png', fullPage: true })
  })

})
