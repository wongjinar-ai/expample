# CLAUDE.md — Himmapun Retreat Hotel Operations App

## Project Summary

Hotel management web app for Himmapun Retreat, Chiang Mai, Thailand. Built with Next.js (App Router), Supabase (PostgreSQL + Auth), and TailwindCSS. Hosted on Vercel. All staff access it via a shared URL with individual logins.

AI-powered booking intake is handled via the `/new-booking` Claude Code slash command — paste an OTA screenshot into Claude Code, confirm the extracted fields, and Claude inserts the booking directly into Supabase using the service role key stored in `.env.local`.

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx              Root layout (fonts, Supabase provider)
│   ├── page.tsx                Redirect to /dashboard
│   ├── login/page.tsx          Email + password login form
│   ├── dashboard/page.tsx      Metric cards, weekly grid, room status
│   ├── day-guest/page.tsx      Room × date grid
│   ├── bookings/page.tsx       Full booking list with filters
│   ├── cleaning/page.tsx       Room cleaning status table
│   ├── shifts/page.tsx         Staff weekly rota
│   └── monthly/page.tsx        Monthly income summary
├── components/
│   ├── layout/                 Sidebar, Topbar
│   ├── bookings/               BookingModal
│   ├── dashboard/              MetricCards, WeeklyGrid, OccupancyByRoom
│   └── ui/                     Badge, StatusDropdown
├── lib/
│   ├── supabase/client.ts      Browser Supabase client
│   ├── supabase/server.ts      Server Supabase client
│   ├── constants.ts            ROOMS, ROOM_TYPES, OCC_ROOMS, SOURCES
│   └── helpers.ts              fmtDate, fmtMoney, calcNights, isStayingOn
└── middleware.ts               Auth session guard (redirects to /login)

.claude/commands/
└── new-booking.md              /new-booking slash command for screenshot intake
```

---

## Room Constants

```javascript
const ROOMS = [
  'ม่วง', 'ชมพู', 'ขาว',
  'Tent 1', 'Tent 2', 'Tent 3', 'Tent 4',
  'Bungalow 1', 'Bungalow 2', 'Bungalow 3',
  'Extra 1', 'Extra 2'
];

const OCC_ROOMS = ROOMS.slice(0, 10); // Excludes Extra 1 & Extra 2

const ROOM_TYPES = {
  'ม่วง': 'Standard', 'ชมพู': 'Standard', 'ขาว': 'Standard',
  'Tent 1': 'Tent', 'Tent 2': 'Tent', 'Tent 3': 'Tent', 'Tent 4': 'Tent',
  'Bungalow 1': 'Bungalow', 'Bungalow 2': 'Bungalow', 'Bungalow 3': 'Bungalow',
  'Extra 1': 'Extra', 'Extra 2': 'Extra'
};
```

---

## Business Rules (Non-negotiable)

1. **Occupancy denominator is always 300** (10 rooms × 30 days). Never use actual days in month.
2. **Extra 1 and Extra 2 are never counted** in occupancy %, dashboard metrics, or weekly grid percentages.
3. **Commission is a fixed ฿ amount** entered manually from the OTA statement — never calculated from a percentage.
4. **Net Income = Gross − Commission** — always auto-calculated, never user-entered.
5. **Nights = checkout − checkin** — always auto-calculated in days.
6. **Occupancy % = occupied OCC_ROOMS / 10 × 100**.
7. **Date filter overlap logic:** a booking is included if `booking.checkout >= FROM AND booking.checkin <= TO`.
8. **Day Guest Overview shows all 12 rooms** even when vacant.
9. **Clean status is inline-editable** from the Cleaning Plan panel — no modal required.
10. **isStayingOn(booking, date):** `checkin <= date AND checkout > date AND status IN ['Occupied', 'Check-in', 'Checkout']`.

---

## Data Persistence

- Database: Supabase PostgreSQL
- All reads/writes go through the Supabase JS client (browser) or server client (API routes)
- Row Level Security on all tables: `auth.role() = 'authenticated'`
- The `/new-booking` slash command uses the `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` to write directly via the Supabase REST API — this key is never in the app or committed to git

---

## Booking Object Shape

Column names use `snake_case` in the database (Supabase convention):

```typescript
interface Booking {
  id: number;              // auto-increment (bigserial)
  guest: string;
  guest2: string;          // optional second guest
  room: string;            // must be one of ROOMS[]
  type: 'Standard' | 'Tent' | 'Bungalow' | 'Extra';  // derived from ROOM_TYPES
  guests: number;          // 1–6
  checkin: string;         // YYYY-MM-DD
  checkout: string;        // YYYY-MM-DD
  nights: number;          // auto-calculated
  source: 'Direct' | 'Booking.com' | 'Agoda' | 'Airbnb' | 'Other';
  gross: number;           // ฿, integer
  comm: number;            // ฿, from OTA statement, integer
  net_income: number;      // auto-calculated: gross - comm
  status: 'Upcoming' | 'Check-in' | 'Occupied' | 'Checkout' | 'Completed';
  clean_status: '🟢 Clean' | '🔴 Needs Cleaning' | '🟡 In Progress';
  special: string;
  tm30: boolean;
  booking_ref: string;     // OTA reference, optional
  created_at: string;      // timestamptz, auto
  updated_at: string;      // timestamptz, auto
}
```

---

## Deployment URLs

| Environment | URL |
|-------------|-----|
| Production (Vercel) | https://expample-lake.vercel.app |
| Local dev | http://localhost:3000 |

---

## Supabase Credentials & Tokens

| Key | Where to find it | Where it lives |
|-----|-----------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key | `.env` (never Vercel) |
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → Generate new token | `.env` temporarily, delete after use |

The `SUPABASE_ACCESS_TOKEN` is a personal access token used for admin tasks (e.g. running SQL via the Management API). Generate it when needed, use it, then delete it from `.env` immediately after.

---

## /new-booking Slash Command

The `.claude/commands/new-booking.md` file defines a slash command for adding bookings from OTA screenshots without touching the app UI.

**Workflow:**
1. User pastes a screenshot into Claude Code
2. User types `/new-booking`
3. Claude extracts booking fields from the image
4. Claude shows a confirmation table and asks for the room assignment
5. User types `confirm`
6. Claude inserts the booking into Supabase via REST API using `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`

**Required in `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Design Tokens

```css
--bg:        #0e0f0e;
--surface:   #161815;
--surface2:  #1e201d;
--accent:    #c8e84a;
--text:      #e8ead5;
--muted:     #9a9c8a;

/* Status colors */
--blue:   #60a5fa;   /* Occupied / Check-in */
--green:  #4ade80;   /* Check-in today / Clean */
--amber:  #fbbf24;   /* Checkout / In Progress */
--red:    #f87171;   /* Needs Cleaning */
```

Fonts loaded from Google Fonts:
- `Fraunces` — display/headings
- `DM Sans` — body
- `DM Mono` — data/monospace

---

## Panel Rendering Pattern

Each page (`/dashboard`, `/bookings`, etc.) is a separate Next.js route. Data is fetched from Supabase on page load. There is no global state — each page fetches what it needs. Re-navigate to the page to refresh data (no real-time sync required).

---

## Coding Conventions

- TypeScript throughout — no `any`
- TailwindCSS for all styling — no separate CSS files
- Use `const` and `let`; no `var`
- Date strings are always `YYYY-MM-DD`; use `new Date(dateStr + 'T00:00:00')` to avoid timezone shifts
- Money values are integers (฿, no decimals)
- Always derive `type` from `ROOM_TYPES[room]` — never let the user set it directly
- Always calculate `nights` and `net_income` in code — never trust user input for these fields
