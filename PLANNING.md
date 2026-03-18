# Planning Document — Himmapun Retreat Hotel Operations App

## Status: Ready to build
**Last updated:** 2026-03-18

---

## Decisions Summary

| Question | Decision |
|----------|----------|
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (individual accounts, single role) |
| AI | Anthropic Messages API — server-side only (API key in `.env`) |
| Styling | TailwindCSS (recommended — responsive, beginner-friendly) |
| Real-time sync | Not needed — page refresh acceptable |
| Mobile | Responsive web app (not PWA) |
| Data migration | Import existing Google Sheets data |

---

## Tech Stack

### Next.js (App Router)
- Full-stack: UI and API routes in one project
- Vercel-native — zero-config deployment
- File-based routing maps naturally to the 6 panels
- Server Actions and API Routes let us keep secrets server-side

### Supabase
- Managed PostgreSQL — no server to run
- Built-in Auth with email/password (individual staff accounts)
- Free tier is sufficient for this property's scale
- Dashboard UI makes it easy to inspect and edit data directly
- Easy to migrate from: just import a CSV from Google Sheets

### Anthropic API (Server-side)
- API key stored in Vercel environment variable — never exposed to the browser
- Screenshot uploaded from the browser → sent to a Next.js API route → API route calls Anthropic → returns extracted JSON to the client
- This is the only backend-required feature

### TailwindCSS
- Utility-first, responsive by default — good for mobile layout
- No context-switching between CSS files
- Easy to implement the custom dark design system using CSS variables + Tailwind config

---

## Architecture Overview

```
Browser (Next.js frontend)
        │
        ├── Supabase JS client ──────────────► Supabase (DB + Auth)
        │   (bookings CRUD, auth session)       PostgreSQL tables
        │
        └── fetch('/api/parse-screenshot') ──► Next.js API Route
                                                 │
                                                 └── Anthropic API
                                                     (claude-sonnet-4-20250514)
```

- All database reads/writes go through the Supabase JS client directly from the browser (using Row Level Security policies)
- Only the AI screenshot parsing goes through a Next.js API route (to hide the API key)
- Auth session is managed by Supabase Auth — session token stored in browser cookie

---

## Database Schema

### `bookings`
```sql
id            bigint          primary key, auto-increment
guest         text            not null
guest2        text
room          text            not null
type          text            not null   -- Standard | Tent | Bungalow | Extra
guests        integer         not null   default 1
checkin       date            not null
checkout      date            not null
nights        integer         not null   -- calculated: checkout - checkin
source        text            not null   -- Direct | Booking.com | Agoda | Airbnb | Other
gross         integer         not null   default 0   -- ฿, no decimals
comm          integer         not null   default 0   -- ฿, from OTA statement
net_income    integer         not null   -- calculated: gross - comm
status        text            not null   -- Upcoming | Check-in | Occupied | Checkout | Completed
clean_status  text            not null   default '🟢 Clean'
special       text
tm30          boolean         not null   default false
booking_ref   text
created_at    timestamptz     default now()
updated_at    timestamptz     default now()
```

### `monthly_income`
```sql
id            bigint          primary key, auto-increment
month         text            not null unique   -- e.g. "Jan 2026"
cafe          integer         not null   default 0
grab          integer         not null   default 0
lineman       integer         not null   default 0
cooking       integer         not null   default 0
vehicle       integer         not null   default 0
created_at    timestamptz     default now()
updated_at    timestamptz     default now()
```

### `staff`
```sql
id            bigint          primary key, auto-increment
name          text            not null
role          text            not null   -- Front Desk | Housekeeping | Maintenance | Security
shift         text            not null   -- Morning | Evening | Night
time          text                       -- e.g. "07:00–15:00"
mon           text            default 'Off'
tue           text            default 'Off'
wed           text            default 'Off'
thu           text            default 'Off'
fri           text            default 'Off'
sat           text            default 'Off'
sun           text            default 'Off'
```

### Auth (managed by Supabase Auth)
- Table: `auth.users` — built-in, managed by Supabase
- No custom roles for now — all authenticated users get full access
- Use Supabase Row Level Security (RLS): `auth.role() = 'authenticated'` on all tables

---

## Project Structure

```
/
├── app/
│   ├── layout.tsx              Root layout (fonts, auth provider)
│   ├── page.tsx                Redirects to /dashboard
│   ├── login/
│   │   └── page.tsx            Login form (Supabase Auth)
│   ├── dashboard/
│   │   └── page.tsx
│   ├── day-guest/
│   │   └── page.tsx
│   ├── bookings/
│   │   └── page.tsx
│   ├── cleaning/
│   │   └── page.tsx
│   ├── shifts/
│   │   └── page.tsx
│   └── monthly/
│       └── page.tsx
│
├── api/
│   └── parse-screenshot/
│       └── route.ts            Calls Anthropic API server-side
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   ├── bookings/
│   │   ├── BookingModal.tsx
│   │   └── ScreenshotUpload.tsx
│   ├── dashboard/
│   │   ├── MetricCards.tsx
│   │   ├── WeeklyGrid.tsx
│   │   └── OccupancyByRoom.tsx
│   └── ui/
│       ├── Badge.tsx           Room type, status, source badges
│       └── StatusDropdown.tsx  Inline clean status selector
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts           Browser Supabase client
│   │   └── server.ts           Server Supabase client (for API routes)
│   ├── constants.ts            ROOMS, ROOM_TYPES, OCC_ROOMS, SOURCES
│   └── helpers.ts              fmtDate, fmtMoney, calcNights, isStayingOn
│
├── .env.local                  ANTHROPIC_API_KEY, Supabase keys
└── tailwind.config.ts          Design tokens (colors, fonts)
```

---

## Authentication Flow

1. Unauthenticated users are redirected to `/login`
2. Login via Supabase Auth (email + password)
3. Session stored in browser cookie — persists across refreshes
4. Supabase middleware checks session on every request
5. Staff accounts are created manually in the Supabase Auth dashboard (no self-signup)

---

## AI Screenshot Parsing Flow (Secured)

```
Browser                         Next.js API Route              Anthropic
   │                                    │                          │
   │  POST /api/parse-screenshot        │                          │
   │  { image: base64, type: mime }     │                          │
   │ ─────────────────────────────────► │                          │
   │                                    │  POST /v1/messages       │
   │                                    │  x-api-key: process.env  │
   │                                    │ ────────────────────────►│
   │                                    │                          │
   │                                    │  { guest, checkin, ... } │
   │                                    │ ◄────────────────────────│
   │  { guest, checkin, checkout, ... } │                          │
   │ ◄─────────────────────────────────  │                          │
```

- `ANTHROPIC_API_KEY` lives only in Vercel environment variables
- The browser never sees the key
- API route validates that the request is authenticated before calling Anthropic

---

## Data Migration from Google Sheets

1. Export each relevant sheet tab as CSV from Google Sheets
2. Map column names to the `bookings` and `monthly_income` schema above
3. Clean and transform dates to `YYYY-MM-DD` format
4. Import via Supabase dashboard CSV import tool (no code needed)
5. Verify row counts match after import

---

## Prerequisites — Before Starting Phase 1

Node.js is required to run the project. It is not yet installed on this machine.

### Install Node.js (do this first)

**Option A — via nvm (recommended):**
```bash
# 1. Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 2. Restart your terminal, then install the LTS version of Node
nvm install --lts

# 3. Verify installation
node -v && npm -v
```

**Option B — direct download:**
Go to https://nodejs.org and download the LTS installer for macOS.

Once `node -v` and `npm -v` both return version numbers, Node is ready.

---

### Scaffold the Project (run after Node is installed)

From the repo root (`/Users/macbookairm1/Documents/Github/expample`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

Then install Supabase and Anthropic packages:
```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
```

Create the environment file:
```bash
cp .env.example .env.local
```

Add these keys to `.env.local` (get values from Supabase dashboard and Anthropic console):
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Run the dev server:
```bash
npm run dev
```

App will be available at http://localhost:3000

---

## Build Phases

### Phase 1 — Foundation
- [ ] Initialize Next.js project with TailwindCSS
- [ ] Connect Supabase (DB + Auth)
- [ ] Create DB tables and RLS policies
- [ ] Login page + auth middleware
- [ ] Sidebar + layout shell

### Phase 2 — Core Booking Features
- [ ] All Bookings page (list, filters, date range)
- [ ] New / Edit Booking modal (manual entry)
- [ ] Delete booking
- [ ] Cleaning Plan page (inline clean status update)

### Phase 3 — Dashboard & Views
- [ ] Dashboard (metric cards, weekly grid, occupancy by room)
- [ ] Day Guest Overview
- [ ] Staff Shifts page

### Phase 4 — AI & Monthly Summary
- [ ] Screenshot upload + `/api/parse-screenshot` route
- [ ] Monthly Summary page
- [ ] Monthly other income (manual entry per month)

### Phase 5 — Data Migration & Polish
- [ ] Import Google Sheets data
- [ ] Mobile responsive QA
- [ ] Responsive layout polish for small screens
- [ ] User acceptance testing with staff

---

## Decisions Log

| Question | Answer |
|----------|--------|
| Staff email format | Any email — defined per person when creating accounts |
| Staff account management | Via Supabase Auth dashboard — no in-app admin screen needed |
| Google Sheets migration | Deferred — start with a clean database on the prototype |
