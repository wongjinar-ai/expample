# /implement — Test-Driven Development for Himmapun Retreat

Use this skill whenever implementing a new feature or page. Write tests first, then implement, then debug until all green.

---

## TDD Workflow

### Phase 1 — Understand the feature

Before writing any code:
1. Read the relevant section of `CLAUDE.md` (business rules, data shape, routes)
2. Load `/branding` context — all UI must match Himmapun brand (`#4b00a5`, `#ff87ff`, DM Mono headings)
3. Identify: what pages/components need to be created? What Supabase tables/columns are needed?
4. Ask the user to confirm scope if anything is unclear

---

### Phase 2 — Write the tests first

Create a new test file at `tests/m<N>-<feature>.spec.ts` following these conventions:

```typescript
import { test, expect, Page } from '@playwright/test'
import fs from 'fs'

const EMAIL    = process.env.TEST_USER_EMAIL!    // from .env
const PASSWORD = process.env.TEST_USER_PASSWORD! // from .env

fs.mkdirSync('test-results/screenshots', { recursive: true })

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}
```

**Test writing rules:**
- Use `getByRole()` for buttons and headings (most reliable)
- Use `getByLabel()` for form inputs — requires `htmlFor` + `id` in the component
- Use `getByPlaceholder()` for inputs without labels
- Use `locator('#id')` for modal inputs (our modals use `id="bm-*"` prefix)
- Avoid `getByText()` for headings — use `getByRole('heading', { name: ... })` instead
- Register `page.once('dialog', d => d.accept())` immediately before the action that triggers a confirm dialog — never register it twice
- Each test takes a screenshot: `await page.screenshot({ path: 'test-results/screenshots/m<N>-<NN>-<name>.png', fullPage: true })`
- Use `test.beforeAll` to clean up test data created in previous runs
- Tests within a describe block may depend on shared DB state — run in serial order

**Coverage to include for each feature:**
1. Page loads with correct heading and empty state
2. Create/add new item — modal opens, form fills, save works
3. Edit existing item — click row, change value, save
4. Filter/search if applicable
5. Delete/remove item
6. Validation — required fields, edge cases

---

### Phase 3 — Run tests (they will fail — that's expected)

Invoke the `/test` skill in headed mode to run the new tests:
- They will fail because the implementation doesn't exist yet
- This confirms the tests are correctly written
- Note which assertions fail and why

---

### Phase 4 — Implement the feature

Build the implementation in this order:

1. **Database** (if needed): Create Supabase table via Management API
   ```bash
   curl -s -X POST "https://api.supabase.com/v1/projects/cbtyidtpgigflqqqgoiz/database/query" \
     -H "Authorization: Bearer $(grep SUPABASE_ACCESS_TOKEN .env | cut -d= -f2)" \
     -H "Content-Type: application/json" \
     -d @/tmp/query.json
   ```
   Write SQL to a file first, then send it.

2. **Constants/types** in `src/lib/constants.ts` if new enums needed

3. **Helpers** in `src/lib/helpers.ts` if new utility functions needed

4. **UI Components**:
   - `src/components/ui/` — reusable badges, dropdowns
   - `src/components/<feature>/` — feature-specific modal or panel

5. **Page** at `src/app/<route>/page.tsx` — always `'use client'` if it fetches data

**Brand rules to enforce on every component:**
- Background: `var(--bg)` or `var(--surface)` or `var(--surface2)`
- Primary accent: `var(--accent)` = `#4b00a5` for buttons, active states
- Secondary accent: `var(--accent2)` = `#ff87ff` for highlights, prices, pink text
- Headings: `fontFamily: 'var(--font-dm-mono)'`
- Body/labels: `fontFamily: 'var(--font-dm-sans)'`
- Data/numbers/dates: `fontFamily: 'var(--font-dm-mono)'`
- Cards: `background: 'var(--surface)'`, `border: '1px solid #2e2040'`, `borderRadius: '1rem'`
- Inputs: `background: 'var(--surface2)'`, `border: '1px solid #3a2d50'`, `borderRadius: '0.75rem'`
- Form inputs MUST have matching `htmlFor` + `id` for Playwright `getByLabel()` to work

6. **TypeScript check** before running tests:
   ```bash
   export PATH="/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin:$PATH" && npx tsc --noEmit 2>&1
   ```
   Fix ALL type errors before proceeding.

---

### Phase 5 — Debug loop (invoke /test skill)

Run the tests with `/test` and enter the debug loop:

For each failure:
1. Read error + Playwright call log carefully
2. Read the failure screenshot
3. Identify root cause (wrong selector, missing element, wrong data, wrong URL)
4. Fix code (prefer fixing the app, not the test — unless the test assertion is wrong)
5. Re-run just the failing test: `npx playwright test <file> -g "<test name>" --headed`
6. Repeat until that test passes
7. Move to next failure

Common pitfalls:
- `getByLabel('X')` fails → missing `htmlFor="id"` on label or `id` on input
- Modal heading strict mode → use `getByRole('heading', { name: ... })`
- Test depends on data from previous test that failed → fix upstream test first
- Dialog "already handled" → remove duplicate `page.once('dialog', ...)` calls
- Supabase 401 → check RLS policy exists for authenticated role
- Supabase column missing → check table schema matches Booking interface in CLAUDE.md

---

### Phase 6 — Full suite regression check

After the new tests pass, use `/test` → "All suites" to run everything and ensure nothing broke.

---

### Phase 7 — Screenshot review & visual polish

Read and display key screenshots. Check:
- [ ] Correct brand purple (`#4b00a5`) on sidebar and buttons
- [ ] Pink (`#ff87ff`) used for accents, prices, highlights
- [ ] DM Mono font on headings and data cells
- [ ] Rounded corners (`rounded-xl` / `rounded-2xl`)
- [ ] Dark theme throughout — no white backgrounds
- [ ] Logo visible in sidebar

Fix any visual issues before committing.

---

### Phase 8 — Commit

```bash
export PATH="/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin:$PATH" && \
  git add -A && \
  git commit -m "$(cat <<'EOF'
M<N>: <feature name> — all tests passing

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)" && git push origin main
```

Report: ✓ N/N tests passing, committed and pushed.

---

## Credential & environment reference

- **Test credentials**: `.env` at project root
  - `TEST_USER_EMAIL=wongjina.r@gmail.com`
  - `TEST_USER_PASSWORD=mookata`
- **Supabase Management API token**: `SUPABASE_ACCESS_TOKEN` in `.env`
- **Supabase project ref**: `cbtyidtpgigflqqqgoiz`
- **Node path**: `/Users/macbookairm1/.nvm/versions/node/v24.14.0/bin/`
- **Dev server**: localhost:3000 (auto-started by Playwright)
- **Test screenshots**: `test-results/screenshots/`
- **Test files**: `tests/` directory, named `m<N>-<feature>.spec.ts`
