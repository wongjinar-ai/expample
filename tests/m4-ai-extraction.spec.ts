/**
 * M4 — AI Extraction Tests
 *
 * Tests /api/extract-passport (OCR) and the full UI upload → OCR → form fill flow.
 *
 * Fixtures (tests/fixtures/):
 *   passport-sample.jpg     — original IMG_3333.HEIC (resized to 1200px for speed)
 *   passport-uk-sample.jpg  — UK passport: FLO DAVEY, 150192197 (save file here manually)
 *
 * If passport-uk-sample.jpg is missing, the UK-specific tests are skipped automatically.
 */

import { test, expect, Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// ── Credentials ──────────────────────────────────────────────────────────────
const EMAIL    = process.env.TEST_USER_EMAIL!
const PASSWORD = process.env.TEST_USER_PASSWORD!

// ── Fixture paths ─────────────────────────────────────────────────────────────
const FIXTURE_DIR   = path.resolve('tests/fixtures')
const SAMPLE_1      = path.join(FIXTURE_DIR, 'passport-sample.jpg')     // IMG_3333 (unknown content)
const SAMPLE_UK     = path.join(FIXTURE_DIR, 'passport-uk-sample.jpg')  // FLO DAVEY – 150192197
const SS_DIR        = 'test-results/screenshots'

// Known expected values for the UK passport sample
const UK_EXPECTED = {
  name:           'FLO DAVEY',
  passport_number:'150192197',
  nationality:    'BRITISH CITIZEN',
  dob:            '2007-06-17',
  expiry:         '2034-06-28',
}

fs.mkdirSync(SS_DIR, { recursive: true })

// ── Helpers ───────────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.waitForLoadState('networkidle')
}

function imageToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64')
}

// ── Setup ─────────────────────────────────────────────────────────────────────
test.beforeAll(() => {
  if (!fs.existsSync(SAMPLE_1)) throw new Error(`Missing fixture: ${SAMPLE_1}`)
  console.log(`[setup] passport-sample.jpg   : ${(fs.statSync(SAMPLE_1).size / 1024).toFixed(0)} KB`)
  if (fs.existsSync(SAMPLE_UK)) {
    console.log(`[setup] passport-uk-sample.jpg: ${(fs.statSync(SAMPLE_UK).size / 1024).toFixed(0)} KB`)
  } else {
    console.log('[setup] passport-uk-sample.jpg: NOT FOUND — UK-specific tests will be skipped')
    console.log('[setup] To enable: save the UK passport JPEG to tests/fixtures/passport-uk-sample.jpg')
  }
})

test.describe.configure({ mode: 'serial' })

// ══════════════════════════════════════════════════════════════════════════════
// API-level — fast, no browser
// ══════════════════════════════════════════════════════════════════════════════
test.describe('M4 — API: /api/extract-passport', () => {

  test('returns structured JSON for passport-sample.jpg', async ({ request }) => {
    const imageBase64 = imageToBase64(SAMPLE_1)
    const b64KB = (imageBase64.length / 1024).toFixed(0)
    console.log(`[api] Sending passport-sample.jpg as base64 (${b64KB} KB)`)

    const res = await request.post('/api/extract-passport', {
      data: { imageBase64, mediaType: 'image/jpeg' },
    })

    const rawText = await res.text()
    console.log(`[api] HTTP status: ${res.status()}`)
    console.log(`[api] Raw response (first 300 chars): ${rawText.slice(0, 300)}`)
    expect(res.status()).toBe(200)

    const body = JSON.parse(rawText) as Record<string, string>
    console.log('[api] Response:', JSON.stringify(body, null, 2))

    expect(typeof body.name).toBe('string')
    expect(typeof body.passport_number).toBe('string')
    expect(typeof body.nationality).toBe('string')
    expect(typeof body.dob).toBe('string')
    expect(typeof body.expiry).toBe('string')

    const hasData = body.name.trim() !== '' || body.passport_number.trim() !== ''
    if (!hasData) console.warn('[api] ⚠ Both name and passport_number are empty — OCR may have failed')
    expect(hasData).toBe(true)
  })

  test('UK passport (FLO DAVEY) — exact field extraction', async ({ request }) => {
    if (!fs.existsSync(SAMPLE_UK)) {
      test.skip(true, 'passport-uk-sample.jpg not found in tests/fixtures/')
      return
    }

    const imageBase64 = imageToBase64(SAMPLE_UK)
    console.log(`[api] Sending passport-uk-sample.jpg (${(imageBase64.length / 1024).toFixed(0)} KB base64)`)

    const res = await request.post('/api/extract-passport', {
      data: { imageBase64, mediaType: 'image/jpeg' },
    })

    const rawText = await res.text()
    console.log(`[api] HTTP status: ${res.status()}`)
    console.log(`[api] Raw response: ${rawText.slice(0, 300)}`)
    expect(res.status()).toBe(200)

    const body = JSON.parse(rawText) as Record<string, string>
    console.log('[api] Extracted:', JSON.stringify(body, null, 2))
    console.log('[api] Expected: ', JSON.stringify(UK_EXPECTED, null, 2))

    expect(body.name).toBe(UK_EXPECTED.name)
    expect(body.passport_number).toBe(UK_EXPECTED.passport_number)
    expect(body.nationality).toBe(UK_EXPECTED.nationality)
    expect(body.dob).toBe(UK_EXPECTED.dob)
    expect(body.expiry).toBe(UK_EXPECTED.expiry)
  })

  test('returns empty fields gracefully for non-passport image', async ({ request }) => {
    // 1×1 white PNG — not a passport
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='
    const res = await request.post('/api/extract-passport', {
      data: { imageBase64: tinyPng, mediaType: 'image/png' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json() as Record<string, string>
    console.log('[api] Graceful fallback:', JSON.stringify(body))
    expect(body.name).toBe('')
    expect(body.passport_number).toBe('')
  })

})

// ══════════════════════════════════════════════════════════════════════════════
// UI-level — full upload → OCR → form fill in the browser
// ══════════════════════════════════════════════════════════════════════════════
test.describe('M4 — UI: passport upload in booking modal', () => {

  test('DOC upload triggers OCR and fills passport fields (Guest 1)', async ({ page }) => {
    await login(page)
    await page.goto('/bookings')
    await page.getByRole('button', { name: '+ New Booking' }).click()
    await expect(page.getByRole('heading', { name: 'New Booking' })).toBeVisible()
    await page.screenshot({ path: `${SS_DIR}/m4-01-modal-open.png`, fullPage: true })
    console.log('[ui] Booking modal opened')

    // Intercept the hidden file input triggered by the "📷 DOC" button
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /DOC|Re-upload/ }).first().click(),
    ])
    const fixture = fs.existsSync(SAMPLE_UK) ? SAMPLE_UK : SAMPLE_1
    console.log(`[ui] Uploading: ${path.basename(fixture)}`)
    await fileChooser.setFiles(fixture)
    await page.screenshot({ path: `${SS_DIR}/m4-02-file-selected.png`, fullPage: true })

    // Wait for spinner → done
    await expect(page.getByText('⏳ Scanning…')).toBeVisible({ timeout: 5_000 })
    console.log('[ui] OCR in progress…')
    await page.screenshot({ path: `${SS_DIR}/m4-03-scanning.png`, fullPage: true })
    await expect(page.getByText('⏳ Scanning…')).not.toBeVisible({ timeout: 30_000 })
    console.log('[ui] OCR complete')
    await page.screenshot({ path: `${SS_DIR}/m4-04-ocr-done.png`, fullPage: true })

    // Ensure accordion is open (click toggle if not yet visible)
    const passportNumInput = page.locator('input[placeholder="e.g. CFL1ZGZ12"]').first()
    const isVisible = await passportNumInput.isVisible().catch(() => false)
    if (!isVisible) {
      console.log('[ui] Accordion closed — clicking ▼ Passport toggle')
      await page.getByRole('button', { name: /Passport/ }).first().click()
      await expect(passportNumInput).toBeVisible({ timeout: 3_000 })
    }

    const passportNum  = await passportNumInput.inputValue().catch(() => '')
    const passportName = await page.locator('input[placeholder="As printed on passport"]').first().inputValue().catch(() => '')
    console.log(`[ui] passport_number: "${passportNum}"`)
    console.log(`[ui] passport_name:   "${passportName}"`)
    await page.screenshot({ path: `${SS_DIR}/m4-05-fields-filled.png`, fullPage: true })

    // If UK fixture present, assert exact values
    if (fixture === SAMPLE_UK) {
      expect(passportNum).toBe(UK_EXPECTED.passport_number)
      expect(passportName).toBe(UK_EXPECTED.name)
    } else {
      const hasData = passportNum.trim() !== '' || passportName.trim() !== ''
      if (!hasData) console.warn('[ui] ⚠ Fields appear empty — check screenshot m4-05-fields-filled.png')
      expect(hasData).toBe(true)
    }
    console.log('[ui] ✓ Passport OCR auto-fill working')
  })

})
