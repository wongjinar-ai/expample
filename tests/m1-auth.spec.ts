import { test, expect } from '@playwright/test'
import fs from 'fs'

const EMAIL    = process.env.TEST_USER_EMAIL!
const PASSWORD = process.env.TEST_USER_PASSWORD!

// Ensure screenshot dir exists
fs.mkdirSync('test-results/screenshots', { recursive: true })

test.describe('M1 — Auth & Layout', () => {

  test('unauthenticated visit redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('Himmapun Retreat')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/01-login-page.png', fullPage: true })
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill('wrongpassword')
    await page.screenshot({ path: 'test-results/screenshots/02-login-filled.png', fullPage: true })
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/invalid/i)).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/03-login-error.png', fullPage: true })
  })

  test('correct credentials logs in and shows dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Himmapun')).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/04-dashboard.png', fullPage: true })
  })

  test('sidebar nav links are all present', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    for (const label of ['Dashboard', 'Day Guest', 'Bookings', 'Cleaning', 'Shifts', 'Monthly']) {
      await expect(page.getByText(label).first()).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/screenshots/05-sidebar.png', fullPage: true })
  })

  test('sign out returns to /login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(EMAIL)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await page.screenshot({ path: 'test-results/screenshots/06-before-signout.png', fullPage: true })
    await page.getByText('Sign out').click()
    await expect(page).toHaveURL(/\/login/)
    await page.screenshot({ path: 'test-results/screenshots/07-after-signout.png', fullPage: true })
  })

})
