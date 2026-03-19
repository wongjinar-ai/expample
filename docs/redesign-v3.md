# Redesign Plan — v3 Visual & UX Overhaul

**Reference:** `/Users/macbookairm1/Downloads/hotel_complete_v3.html`
**Started:** 2026-03-19
**Status:** Planning

---

## What We're Changing and Why

The reference HTML (`hotel_complete_v3.html`) shows a lighter, more information-dense design with a top tab bar instead of a sidebar. The goals of this overhaul are:

- **More information per screen:** Compact 13px tables and 11px labels vs. the current loose layout
- **Light theme:** Easier to read in a bright reception/outdoor environment
- **Tab bar navigation:** Horizontal tabs take less horizontal space and feel more native on mobile
- **Richer dashboard:** Add occupancy dots, daily occupancy grid, income summary, cleaning & shift summaries directly on the dashboard
- **Implement deferred pages:** Shifts (currently "coming soon") and Income & OTA (currently a placeholder)
- **Cleaning tasks model:** Add task descriptions, assigned staff, and priority to the cleaning workflow

---

## Summary of Changes

### Visual / Design Changes
| What | From | To |
|---|---|---|
| Color theme | Dark purple (`#0d0b12`) | Light neutral (off-white backgrounds) |
| Badges | Dark semi-transparent bg + bright text | Pastel bg + dark text |
| Border weight | 1px `#2e2040` | 0.5px `rgba(0,0,0,0.09)` |
| Table padding | `px-4 py-3` (16px/12px) | `px-2.5 py-2` (10px/8px) |
| Card padding | `p-6` | `p-3.5 p-4` (14px/16px) |
| Font usage | DM Mono for all labels & data | DM Sans throughout; mono only for booking refs/IDs |
| Section labels | 0.7rem mono uppercase | 11px sans 500 uppercase |
| Metric values | 24px mono | 20px sans 500 |
| Navigation | Left sidebar 14rem fixed | Top tab bar, full width |

### UX / Navigation Changes
| What | From | To |
|---|---|---|
| Navigation component | `Sidebar.tsx` | `TopTabBar.tsx` |
| Layout wrapper | `AppShell` (flex + sidebar) | `AppShell` (top nav + scrollable body) |
| Tabs | Dashboard / Day Guest / Bookings / Cleaning / Shifts / Monthly | Dashboard / Rooms & guests / Income & OTA / Cleaning plan / Staff shifts |
| Day Guest page | Separate route `/day-guest` | Removed — folded into Rooms & guests |
| Active tab indicator | Purple background | Bottom border 2px `--text` color |

### Logic Changes
| Area | Change |
|---|---|
| Dashboard | Add 5 new sections (see Phase 5 below) |
| Rooms & guests | Show operational columns (price/night, type) instead of financial columns (gross, net, TM30) |
| Income & OTA | New page replacing Monthly placeholder — per-booking revenue table + metric cards |
| Cleaning | Add task description (derived from status), assigned staff (stored), priority (derived from status) |
| Shifts | Full implementation reading from `staff` table |
| Badges | All badge components use new pastel color map |

### Database Changes
| Change | Type | Details |
|---|---|---|
| `bookings.cleaning_assigned_to` | New column | `text`, nullable — who is assigned to clean this room |
| `staff` table | Already designed, needs to be created | See SQL below |
| `monthly_income` table | Repurposed | Will serve Income & OTA page (already exists in schema) |

**No columns are being removed.** The `bookings` table's financial columns (gross, comm, net_income, tm30) stay — they just move to the Income & OTA tab instead of the Rooms & guests tab.

---

## Implementation Phases

### Phase 1 — Light Theme Tokens
**Files:** `src/app/globals.css`
**Risk:** Low — purely visual, nothing breaks

Replace the dark CSS variables with a light palette. All Tailwind utilities using these vars update automatically everywhere.

New token values:
```css
:root {
  --bg:        #FAFAF8;
  --surface:   #F3F2EE;
  --surface2:  #EBEBЕ6;   /* inputs, hover states */
  --border:    rgba(0,0,0,0.09);
  --border2:   rgba(0,0,0,0.15);
  --text:      #1A1A19;
  --muted:     #6B6B69;
  --muted2:    #9A9A98;   /* placeholder, tertiary */
}
```

Semantic colors (replacing current accent/accent2/blue/green/amber/red):
```css
  /* Metric & status accent colors */
  --color-blue:   #185FA5;
  --color-green:  #3B6D11;
  --color-amber:  #BA7517;
  --color-red:    #A32D2D;
  --color-teal:   #0F6E56;
  --color-purple: #3C3489;
```

Badge color map (replace current glowing-on-dark style):
```
Direct / Check-in / Done / Clean / Morning:    bg #EAF3DE  text #27500A
OTA / Evening shift / Upcoming:                bg #EEEDFE  text #3C3489
Occupied / Night shift:                        bg #E6F1FB  text #0C447C
Checkout / In Progress / Pending:              bg #FAEEDA  text #633806
Vacant / Completed:                            bg #F1EFE8  text #444441
Needs Cleaning / Urgent / Maintenance:         bg #FCEBEB  text #791F1F
```

---

### Phase 2 — Badge Component
**Files:** `src/components/ui/Badge.tsx`
**Risk:** Low — purely visual

Update `StatusBadge`, `CleanBadge`, and add `SourceBadge` and `ShiftBadge` using the pastel map above. Remove `rgba(...)` transparency tricks — use solid hex values.

New components to add:
- `SourceBadge` — Direct (green) vs OTA (purple) vs per-source
- `ShiftBadge` — Morning (green) / Evening (purple) / Night (blue)
- `PriorityText` — not a badge, just colored text: urgent=red 500, normal=default, low=green

---

### Phase 3 — Top Tab Bar + Layout
**Files:** `src/components/layout/Sidebar.tsx` (delete), `src/components/layout/TopTabBar.tsx` (new), `src/components/layout/AppShell.tsx` (update), `src/app/layout.tsx` (update)
**Risk:** Medium — structural change, affects every page

**Architecture — single route, client-side tabs:**

All 5 tabs live in one page at `/dashboard`. A `tab` query param enables deep-linking (e.g. `/dashboard?tab=rooms`). All legacy routes redirect to `/dashboard` with the correct param:

| Old route | Redirect target |
|---|---|
| `/bookings` | `/dashboard?tab=rooms` |
| `/monthly` | `/dashboard?tab=income` |
| `/cleaning` | `/dashboard?tab=cleaning` |
| `/shifts` | `/dashboard?tab=shifts` |
| `/day-guest` | `/dashboard?tab=rooms` |

Each tab is a standalone React component (`DashboardTab`, `RoomsTab`, `IncomeTab`, `CleaningTab`, `ShiftsTab`) that fetches its own data lazily on first activation and caches it in state for the session. Switching tabs is instant — no route change, no loading flash.

**TopTabBar structure:**
```
[Hotel name + date]                          [Sign out]
─────────────────────────────────────────────────────
Dashboard | Rooms & guests | Income & OTA | Cleaning plan | Staff shifts
```

- Left: "Himmapun Retreat" in 500 weight + today's date in secondary color below
- Right: Sign out button (action-btn style)
- Tab list: flex row, border-bottom 0.5px `--border`
- Active tab: `border-bottom: 2px solid var(--text)`, font-weight 500
- Tab font: 13px DM Sans
- Tab padding: `10px 14px`
- Route mapping:
  - `/dashboard` → Dashboard
  - `/bookings` → Rooms & guests
  - `/monthly` → Income & OTA
  - `/cleaning` → Cleaning plan
  - `/shifts` → Staff shifts

**AppShell update:**
```tsx
// Before: flex h-screen overflow-hidden with Sidebar on left
// After: flex-col with TopTabBar on top, main scrollable below
<div className="min-h-screen" style={{ background: 'var(--bg)' }}>
  <TopTabBar />
  <main style={{ padding: '1rem 1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
    {children}
  </main>
</div>
```

**Day Guest page (`/day-guest`):** Keep the route alive but redirect to `/bookings`. The room×date grid functionality is folded into the Rooms & guests tab via a date column view or removed in favour of the status filter.

---

### Phase 4 — Typography & Table Density
**Files:** All page files and table components
**Risk:** Low-medium — tedious but mechanical

Apply globally to all tables:
- `th`: `font-size: 11px`, `font-weight: 500`, `padding: 7px 10px`, `border-bottom: 0.5px solid var(--border)`
- `td`: `font-size: 13px`, `padding: 8px 10px`, `border-bottom: 0.5px solid var(--border)`
- `tr:last-child td`: `border-bottom: none`
- Table container: `border: 0.5px solid var(--border)`, `border-radius: 8px`

Cards:
- `padding: 14px 16px`
- `border: 0.5px solid var(--border)`
- `border-radius: 8px`

Section labels (all uppercase headers):
```css
font-size: 11px;
font-weight: 500;
color: var(--muted);
text-transform: uppercase;
letter-spacing: 0.05em;
margin-bottom: 12px;
```

Remove DM Mono from: section labels, table headers, page titles, metric labels, guest names.
Keep DM Mono only for: booking_ref values, room codes where needed.

---

### Phase 5 — Dashboard Additions
**Files:** `src/app/dashboard/page.tsx`
**Risk:** Low — additive only, no existing sections change

Add these sections below the existing "Upcoming Check-ins" table:

#### 5a: Two-col row — "Daily occupancy this week" + "Income summary"

**Daily occupancy this week:**
- Calculate Mon–Sun of current week
- For each day: count `OCC_ROOMS` where a booking `isStayingOn(b, date)` is true
- Render 7 mini cards: day name, count, percentage (`count/10*100`)
- Today's card: border highlight with `--color-blue`

**Income summary:**
- Three rows: Gross revenue (green) / OTA commission (red) / Net income (blue)
- Source breakdown below a divider: Direct / Booking.com / Agoda / Airbnb — room count each
- Data: filter bookings where `status NOT IN ['Completed']` for current month

#### 5b: "Occupancy by room" dot visualization

- One row per `OCC_ROOM` (10 rooms)
- Columns: room name (52px) | type (54px) | dots + meta
- Max dot capacity per type: Standard=2, Tent=2, Bungalow=3
- Filled dot: 13px circle `#378ADD`, empty dot: 13px circle gray border
- Meta text (after dots): "Vacant" in muted italic / "Arriving · Guest Name" in green / "Checkout · Guest Name" in amber / "N guests · Guest Name" in default

#### 5c: Two-col row — "Cleaning status today" + "Staff on shift today"

**Cleaning status today** (reads from bookings `clean_status`):
- Urgent (checkout today, needs cleaning) count
- In Progress count
- Completed (Clean) count
- Total count

**Staff on shift today** (reads from `staff` table once implemented):
- Morning / Evening / Night / Total counts
- Falls back gracefully to "—" if `staff` table is empty

---

### Phase 6 — Rooms & Guests Page
**Files:** `src/app/bookings/page.tsx`
**Risk:** Low — column changes only, data model unchanged

**Remove from table:** Gross, Net, TM30 columns
**Add to table:** Type column (derived from `ROOM_TYPES[room]`), Price/night (= `gross / nights`, formatted)
**Reorder columns:** Room · Type · Guests · Guest name · Check-in · Check-out · Nights · Source · Price/night · Status

**Filter changes:**
- Status filter options: All / Occupied / Vacant / Checkout today / Check-in today (instead of all statuses)
- Add "Vacant" rooms to the table (rooms with no current booking shown as a row with "—" guest and "Vacant" badge)

**Keep unchanged:** Click row → BookingModal, + New Booking button, search input

---

### Phase 7 — Income & OTA Page
**Files:** `src/app/monthly/page.tsx` (full rewrite)
**Risk:** Low — replaces a placeholder

**Metric cards row (4 cards):**
- Gross total (green)
- OTA commission (red, minus sign)
- Net income (blue)
- Avg commission rate: `(total_comm / total_gross * 100)`%

**Revenue breakdown table:**
- Columns: Room · Guest · Check-in · Check-out · Nights · Gross · Comm (฿) · Net income · Source
- Default filter: current month
- Month selector dropdown (past 12 months)
- Footer row: totals for Gross / Comm / Net

**OTA commission reference grid (static):**
- 4 cards: Direct (0%) / Booking.com (15%) / Agoda (18%) / Airbnb (14%)
- Note: "Commission is entered manually per booking from OTA statement"

**Note on `monthly_income` table:** The existing `monthly_income` table (cafe, grab, lineman, cooking, vehicle) is kept but not shown on this page. It can be surfaced as a separate "Other income" section within this tab or a future sub-tab.

---

### Phase 8 — Cleaning Plan Page
**Files:** `src/app/cleaning/page.tsx`, `src/lib/constants.ts` (priority helpers)
**Database:** Add `cleaning_assigned_to text` column to `bookings`
**Risk:** Medium — requires a DB migration + UI change

**New table columns:** Room · Task · Assigned to · Priority · Status

**Derived values (no DB storage needed):**
- `task`: derived from booking status:
  - `Checkout` → "Full turnover clean"
  - `Check-in` → "Prepare for arrival"
  - `Occupied` → "Daily refresh"
  - Vacant → "Inspect room"
- `priority`: derived from booking status:
  - `Checkout` or `Check-in` today → urgent (red text, 500 weight)
  - `Occupied` → normal (default text)
  - Vacant → low (green text)

**Stored value (new DB column):**
- `cleaning_assigned_to` — staff name, editable inline in the table cell (click to edit, dropdown of staff names, saves immediately)

**Filter toolbar:** All tasks / Urgent first (sorted) / Pending only / Done

**Status column:** Replace 3-button toggle with a single `<select>` dropdown styled as a pastel badge — smaller, less visual noise.

**DB migration SQL:**
```sql
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS cleaning_assigned_to text;
```

---

### Phase 9 — Staff Shifts Page
**Files:** `src/app/shifts/page.tsx` (full implementation)
**Database:** Create `staff` table (already designed in PLANNING.md)
**Risk:** Medium — new page + new table

**Create `staff` table (run in Supabase SQL editor):**
```sql
CREATE TABLE IF NOT EXISTS staff (
  id    bigserial PRIMARY KEY,
  name  text NOT NULL,
  role  text NOT NULL,   -- Front Desk | Housekeeping | Maintenance | Security
  shift text NOT NULL,   -- Morning | Evening | Night
  time  text,            -- e.g. "07:00–15:00"
  mon   text DEFAULT 'Off',
  tue   text DEFAULT 'Off',
  wed   text DEFAULT 'Off',
  thu   text DEFAULT 'Off',
  fri   text DEFAULT 'Off',
  sat   text DEFAULT 'Off',
  sun   text DEFAULT 'Off'
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users only" ON staff
  FOR ALL USING (auth.role() = 'authenticated');
```

**UI sections:**

*Filter bar:* All shifts / Morning / Evening / Night

*Today's shifts (cards grid):*
- Card per staff member on shift today
- Shows: time (secondary), name (500), role (secondary), shift badge
- Determine "today" from `mon`–`sun` column matching current day of week

*Weekly rota table:*
- Rows: staff name
- Columns: Mon–Sun
- Cell: shift badge (Morning/Evening/Night) or "Off" in muted

---

## Database Migration Summary

| Migration | SQL | When |
|---|---|---|
| Add `cleaning_assigned_to` to bookings | `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cleaning_assigned_to text;` | Before Phase 8 |
| Create `staff` table | See Phase 9 SQL | Before Phase 9 |

The `staff` table already exists in the `PLANNING.md` schema — it just hasn't been created in Supabase yet. Run its `CREATE TABLE` SQL first, then add sample staff rows manually via the Supabase dashboard.

No other tables change. All existing booking data is fully compatible with this redesign.

---

## What Does NOT Change

- `BookingModal` component — no changes to the booking form, OCR, TM30 logic, or passport uploads
- `/new-booking` slash command — works the same
- `ROOMS`, `OCC_ROOMS`, `ROOM_TYPES` constants — unchanged
- Business rules (occupancy denominator = 10, Extra rooms excluded, etc.) — unchanged
- All Supabase queries — same tables, same columns (plus the two additions)
- Auth / middleware — unchanged
- Vercel deployment — unchanged

---

## Execution Order

| # | Phase | Files changed | DB change | Effort |
|---|---|---|---|---|
| 1 | Light theme tokens | `globals.css` | None | 30 min |
| 2 | Badge components | `Badge.tsx` | None | 30 min |
| 3 | Top tab bar + layout | `TopTabBar.tsx` (new), `AppShell.tsx`, `Sidebar.tsx` (delete), `layout.tsx` | None | 1–2 hr |
| 4 | Typography & table density | All page files | None | 1–2 hr |
| 5 | Dashboard additions | `dashboard/page.tsx` | None | 2–3 hr |
| 6 | Rooms & guests page | `bookings/page.tsx` | None | 1 hr |
| 7 | Income & OTA page | `monthly/page.tsx` | None | 1–2 hr |
| 8 | Cleaning plan | `cleaning/page.tsx` | `cleaning_assigned_to` column | 2 hr |
| 9 | Staff shifts | `shifts/page.tsx` | `staff` table | 2–3 hr |

**Total estimate: ~12–16 hours of implementation**

Phases 1–7 can be done in one session with no DB changes. Phases 8–9 require running SQL migrations in Supabase before coding.

---

## Decisions Log

| Question | Decision |
|---|---|
| Keep separate routes or merge into single-page tabs? | **Option B — single `/dashboard` route with client-side tab switching.** All other routes redirect. |
| Where does Day Guest go? | Folded into Rooms & guests tab (current `/bookings`) |
| Task descriptions in cleaning: store or derive? | Derive from booking status — no extra column needed |
| Assigned staff in cleaning: store or derive? | Store in `bookings.cleaning_assigned_to` — cannot be derived |
| Commission percentage in Income tab? | Not shown — Himmapun uses fixed ฿ amounts, not percentages |
| `monthly_income` table (cafe, grab, etc.)? | Kept in DB, not shown in this redesign — future work |
| Mobile breakpoints? | Match HTML: collapse two-col to one-col at 580px |
