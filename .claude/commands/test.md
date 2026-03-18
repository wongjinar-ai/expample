# /test — Himmapun Playwright Test Runner

Run this skill whenever the user wants to run tests, debug failures, or verify a milestone.

---

## Step 1 — Ask the user before doing anything

Use the `AskUserQuestion` tool with TWO questions so the user can navigate with arrow keys and press Enter:

Question 1:
- header: "Test suite"
- question: "Which test suite do you want to run?"
- options:
  - label: "M1 — Auth & Layout", description: "tests/m1-auth.spec.ts"
  - label: "M2 — Bookings & Cleaning", description: "tests/m2-bookings.spec.ts"
  - label: "All suites", description: "Run every test file (npm test)"
  - label: "Custom", description: "I'll type the file path in Other"

Question 2:
- header: "Run mode"
- question: "Run in headed or headless mode?"
- options:
  - label: "Headed (default)", description: "Browser window is visible — you can watch the tests run"
  - label: "Headless", description: "No browser window — faster, good for CI"

Wait for both answers before proceeding.

---

## Step 2 — Environment setup

Always prefix commands with:
```bash
export PATH="/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin:$PATH"
```

The `.env` file at project root holds all credentials and is auto-loaded by `playwright.config.ts` via dotenv.

Test scripts (from package.json):
- `npm run test:m1` → `playwright test tests/m1-auth.spec.ts --headed`
- `npm run test:m2` → `playwright test tests/m2-bookings.spec.ts --headed`
- `npm test`        → `playwright test --headed` (all suites)

For headless, append `-- --headless` to override.

Screenshots are always saved to `test-results/screenshots/` — read and display them after each run.

---

## Step 3 — Run tests with full logging

Run the chosen suite and capture ALL output (stdout + stderr). Do not truncate.

```bash
export PATH="/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin:$PATH" && \
  npx playwright test <FILE> [--headed|--headless] 2>&1 | tee /tmp/pw-run.log
echo "EXIT:$?"
```

After running, always:
1. Print a summary: ✓ X passed, ✘ Y failed
2. For each failure, show:
   - Test name
   - Error message and line number
   - The Playwright call log (the indented lines under the error)
3. Read and display the failure screenshot if one was saved

---

## Step 4 — Debug loop

If any tests fail, enter a debug-fix-rerun loop. For each failure:

1. **Diagnose**: Read the error carefully. Common root causes:
   - **Selector not found / timeout**: The element doesn't exist or has wrong text. Check the component code and screenshot.
   - **Strict mode violation**: Multiple elements match — use `getByRole()` or more specific selectors.
   - **Dialog already handled**: Remove duplicate `page.once('dialog', ...)` calls.
   - **Wrong URL / redirect**: Check proxy.ts auth guard and page routing.
   - **Supabase error**: Check RLS policy, table schema, field names.
   - **Race condition**: Add `await page.waitForTimeout(300)` or wait for a specific element.

2. **Fix**: Edit the failing test OR the application code, whichever is wrong. Prefer fixing the app if the test expectation is correct.

3. **Re-run**: Run only the failing test(s) to iterate faster:
   ```bash
   export PATH="/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin:$PATH" && \
     npx playwright test <FILE> --headed -g "<test name pattern>" 2>&1
   ```

4. **Repeat** until all tests in the suite pass.

5. **Final full run**: Once individual fixes are done, run the full suite one more time to confirm nothing regressed.

---

## Step 5 — Screenshot review

After a successful full run, read and display key screenshots:
- Login page
- Dashboard / main page after login
- The primary feature page for the milestone

Comment on visual issues — wrong colors, misaligned elements, missing brand elements — and fix them before marking the milestone done.

---

## Step 6 — Commit when all green

Once all tests pass and screenshots look correct:

```bash
export PATH="/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin:$PATH" && \
  git add -A && \
  git commit -m "M<N>: all tests passing — <brief description>" && \
  git push origin main
```

Report the final result: ✓ N/N tests passing, committed and pushed to Vercel.

---

## Key project facts to remember during testing

- **Node**: `/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin/` — always export PATH
- **Dev server**: auto-started by Playwright webServer config (port 3000)
- **Test credentials**: stored in `.env` at project root (`/Users/macbookairm1/Documents/Github/expample/.env`)
  - `TEST_USER_EMAIL=wongjina.r@gmail.com`
  - `TEST_USER_PASSWORD=mookata`
  - Auto-loaded by `playwright.config.ts` via `dotenv.config({ path: '.env' })`
- **Supabase project**: `cbtyidtpgigflqqqgoiz` (URL and anon key also in `.env`)
- **Brand colors**: `--accent: #4b00a5` (purple), `--accent2: #ff87ff` (pink)
- **Fonts**: DM Mono for headings/data, DM Sans for body
- **Screenshots**: `test-results/screenshots/` — always review them after a run
- **No `any` in TypeScript** — fix type errors before running tests
- **Modal labels**: use `id` + `htmlFor` so Playwright `getByLabel()` works. Our modal uses `id="bm-*"` prefixed IDs.
- **Dialog handling**: register `page.once('dialog', d => d.accept())` immediately BEFORE the action that triggers it — never register it twice for one action.
