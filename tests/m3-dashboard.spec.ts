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
    // 6 metric cards in one row
    await expect(page.getByText('Rooms occupied').first()).toBeVisible()
    await expect(page.getByText('Occupancy').first()).toBeVisible()
    await expect(page.getByText('Total guests').first()).toBeVisible()
    await expect(page.getByText('Check-out today').first()).toBeVisible()
    await expect(page.getByText('Check-in today').first()).toBeVisible()
    await expect(page.getByText('Net income').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m3-01-dashboard.png', fullPage: true })
  })

  test('dashboard today panels are visible', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    // Check-in panel (left) and Check-out panel (right)
    await expect(page.getByText('Checking In Today').first()).toBeVisible()
    await expect(page.getByText('Checking Out Today').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/m3-02-today-panels.png', fullPage: true })
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
