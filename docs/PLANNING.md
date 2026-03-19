# Planning Document — Himmapun Retreat Hotel Operations App

## Status: Ready to build
**Last updated:** 2026-03-18

---

## Table of Contents

1. [Decisions Summary](#decisions-summary)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Design](#database-design)
5. [Sequence Diagrams](#sequence-diagrams)
6. [User Journeys](#user-journeys)
7. [Project Structure](#project-structure)
8. [Milestones & Working Packages](#milestones--working-packages)
9. [Setup Instructions](#setup-instructions)
10. [Decisions Log](#decisions-log)

---

## Decisions Summary

| Question | Decision |
|----------|----------|
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (individual accounts, single role) |
| AI booking intake | Claude Code `/new-booking` slash command (owner's machine only) |
| Styling | TailwindCSS |
| Real-time sync | Not needed — page refresh acceptable |
| Mobile | Responsive web app (not PWA) |
| Data migration | Deferred — start with clean database |

---

## Tech Stack

### Next.js (App Router)
- Full-stack: UI and API routes in one project
- Vercel-native — zero-config deployment
- File-based routing maps naturally to the 6 panels
- API Routes keep the Anthropic key server-side

### Supabase
- Managed PostgreSQL — no server to run
- Built-in Auth with email/password (individual staff accounts)
- Free tier is sufficient for this property's scale
- Dashboard UI makes it easy to inspect and edit data directly
- Row Level Security (RLS) enforces auth at the database level

### AI Booking Intake — Claude Code Slash Command
- Handled entirely outside the app via `.claude/commands/new-booking.md`
- Owner pastes OTA screenshot into Claude Code, types `/new-booking`
- Claude extracts fields, shows confirmation table, inserts directly into Supabase
- Uses `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` on owner's machine — never in the app or Vercel
- No Anthropic API key needed in the app

### TailwindCSS
- Utility-first, responsive by default
- Custom dark design tokens configured in `tailwind.config.ts`

---

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph Client["Browser (Any Device)"]
        UI[Next.js Frontend]
    end

    subgraph Vercel["Vercel (Hosting)"]
        APP[Next.js App Router]
    end

    subgraph Supabase["Supabase"]
        AUTH[Auth Service]
        DB[(PostgreSQL Database)]
        RLS[Row Level Security]
    end

    subgraph Local["Owner Machine Only"]
        CC[Claude Code]
        ENV2[".env.local with service role key"]
    end

    UI -->|"page requests"| APP
    UI -->|"CRUD via JS client"| DB
    UI -->|"session / login"| AUTH
    CC -->|"INSERT booking via REST API"| DB
    CC --- ENV2
    DB --- RLS
    AUTH -->|"auth.uid()"| RLS

    style Client fill:#1e201d,stroke:#c8e84a,color:#e8ead5
    style Vercel fill:#1e201d,stroke:#60a5fa,color:#e8ead5
    style Supabase fill:#1e201d,stroke:#4ade80,color:#e8ead5
    style Local fill:#1e201d,stroke:#fbbf24,color:#e8ead5
```

### Deployment Pipeline

```mermaid
graph LR
    DEV["Local Dev (localhost:3000)"] -->|git push| GH["GitHub (main branch)"]
    GH -->|auto-deploy| VCL["Vercel (Production)"]
    VCL -->|reads| ENV["Env Vars on Vercel"]

    style DEV fill:#1e201d,stroke:#9a9c8a,color:#e8ead5
    style GH fill:#1e201d,stroke:#9a9c8a,color:#e8ead5
    style VCL fill:#1e201d,stroke:#60a5fa,color:#e8ead5
    style ENV fill:#1e201d,stroke:#f87171,color:#e8ead5
```

---

## Database Design

### Entity Relationship Diagram

```mermaid
erDiagram
    BOOKINGS {
        bigint id PK
        text guest
        text guest2
        text room
        text type
        integer guests
        date checkin
        date checkout
        integer nights
        text source
        integer gross
        integer comm
        integer net_income
        text status
        text clean_status
        text special
        boolean tm30
        text booking_ref
        timestamptz created_at
        timestamptz updated_at
    }

    MONTHLY_INCOME {
        bigint id PK
        text month
        integer cafe
        integer grab
        integer lineman
        integer cooking
        integer vehicle
        timestamptz created_at
        timestamptz updated_at
    }

    STAFF {
        bigint id PK
        text name
        text role
        text shift
        text time
        text mon
        text tue
        text wed
        text thu
        text fri
        text sat
        text sun
    }

    AUTH_USERS {
        uuid id PK
        text email
        timestamptz created_at
    }

    AUTH_USERS ||--o{ BOOKINGS : "authenticated users manage"
    AUTH_USERS ||--o{ MONTHLY_INCOME : "authenticated users manage"
    AUTH_USERS ||--o{ STAFF : "authenticated users manage"
```

### Table Definitions (SQL)

#### `bookings`
```sql
create table bookings (
  id           bigserial primary key,
  guest        text        not null,
  guest2       text,
  room         text        not null,
  type         text        not null,   -- Standard | Tent | Bungalow | Extra
  guests       integer     not null default 1,
  checkin      date        not null,
  checkout     date        not null,
  nights       integer     not null,   -- auto-calculated on save
  source       text        not null,   -- Direct | Booking.com | Agoda | Airbnb | Other
  gross        integer     not null default 0,
  comm         integer     not null default 0,
  net_income   integer     not null,   -- auto-calculated: gross - comm
  status       text        not null,   -- Upcoming | Check-in | Occupied | Checkout | Completed
  clean_status text        not null default '🟢 Clean',
  special      text,
  tm30         boolean     not null default false,
  booking_ref  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Row Level Security
alter table bookings enable row level security;
create policy "Authenticated users only" on bookings
  for all using (auth.role() = 'authenticated');
```

#### `monthly_income`
```sql
create table monthly_income (
  id        bigserial primary key,
  month     text    not null unique,  -- e.g. "Jan 2026"
  cafe      integer not null default 0,
  grab      integer not null default 0,
  lineman   integer not null default 0,
  cooking   integer not null default 0,
  vehicle   integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table monthly_income enable row level security;
create policy "Authenticated users only" on monthly_income
  for all using (auth.role() = 'authenticated');
```

#### `staff`
```sql
create table staff (
  id    bigserial primary key,
  name  text not null,
  role  text not null,   -- Front Desk | Housekeeping | Maintenance | Security
  shift text not null,   -- Morning | Evening | Night
  time  text,            -- e.g. "07:00–15:00"
  mon   text default 'Off',
  tue   text default 'Off',
  wed   text default 'Off',
  thu   text default 'Off',
  fri   text default 'Off',
  sat   text default 'Off',
  sun   text default 'Off'
);

alter table staff enable row level security;
create policy "Authenticated users only" on staff
  for all using (auth.role() = 'authenticated');
```

---

## Sequence Diagrams

### 1. Login Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Middleware as Next.js Middleware
    participant Supabase as Supabase Auth

    User->>Browser: Visit app URL
    Browser->>Middleware: GET /dashboard
    Middleware->>Middleware: Check session cookie
    Middleware-->>Browser: No session — redirect to /login

    User->>Browser: Enter email and password
    Browser->>Supabase: signInWithPassword(email, password)
    Supabase-->>Browser: Session token and user object
    Browser->>Browser: Store session in cookie
    Browser->>Middleware: GET /dashboard
    Middleware->>Middleware: Session valid
    Middleware-->>Browser: Render dashboard
```

### 2. Manual Booking Creation

```mermaid
sequenceDiagram
    actor Staff
    participant Browser
    participant Supabase as Supabase DB

    Staff->>Browser: Click New Booking
    Browser->>Browser: Open modal and clear form
    Staff->>Browser: Fill in all fields manually
    Staff->>Browser: Click Save Booking
    Browser->>Browser: Validate required fields
    Browser->>Browser: Calculate nights from dates
    Browser->>Browser: Calculate net income from gross and comm
    Browser->>Browser: Derive room type from room name
    Browser->>Supabase: INSERT new booking
    Supabase-->>Browser: New booking row with id
    Browser->>Browser: Close modal
    Browser->>Browser: Re-render panel and dashboard
```

### 3. AI Screenshot Booking

```mermaid
sequenceDiagram
    actor Staff
    participant Browser
    participant API as Next.js API Route
    participant Anthropic as Anthropic API
    participant Supabase as Supabase DB

    Staff->>Browser: Click New Booking
    Browser->>Browser: Open modal
    Staff->>Browser: Drop or select screenshot image
    Browser->>Browser: Convert image to base64
    Browser->>Browser: Show loading spinner
    Browser->>API: POST /api/parse-screenshot with image
    API->>API: Verify auth session
    API->>Anthropic: POST /v1/messages with image and prompt
    Note over API,Anthropic: API key stays server-side only
    Anthropic-->>API: guest, dates, price, commission, source
    API-->>Browser: Extracted booking fields
    Browser->>Browser: Auto-fill form fields
    Browser->>Browser: Show thumbnail and summary
    Staff->>Browser: Select room (only manual step)
    Staff->>Browser: Verify and click Save Booking
    Browser->>Supabase: INSERT new booking
    Supabase-->>Browser: Saved
    Browser->>Browser: Close modal and re-render
```

### 4. Inline Clean Status Update

```mermaid
sequenceDiagram
    actor Staff
    participant Browser
    participant Supabase as Supabase DB

    Staff->>Browser: Open Cleaning Plan tab
    Browser->>Supabase: Fetch active bookings
    Supabase-->>Browser: Active bookings list
    Browser->>Browser: Render table with inline dropdowns
    Staff->>Browser: Change clean status in dropdown
    Browser->>Supabase: UPDATE booking clean_status by id
    Supabase-->>Browser: Updated
    Browser->>Browser: Re-render that table row
```

### 5. Vercel Deployment

```mermaid
sequenceDiagram
    participant Dev as Developer (local)
    participant GitHub
    participant Vercel
    participant User as Staff (browser)

    Dev->>GitHub: git push origin main
    GitHub->>Vercel: Webhook trigger (new commit)
    Vercel->>Vercel: Pull code
    Vercel->>Vercel: npm run build
    Vercel->>Vercel: Deploy to CDN
    Vercel-->>Dev: Deploy URL + build logs

    User->>Vercel: Visit app URL
    Vercel-->>User: Serve Next.js app
```

---

## User Journeys

### Journey 1 — Owner: Morning Review

```mermaid
flowchart TD
    A([Open app on phone]) --> B([Login with email and password])
    B --> C([Land on Dashboard])
    C --> D([Check metric cards: occupancy, check-ins, checkouts])
    D --> E([Review who is checking in today])
    E --> F([Review who is checking out today])
    F --> G([Check gross revenue and net income])
    G --> H([Open Cleaning Plan tab])
    H --> I([See which rooms need cleaning])
    I --> J([Check staff shifts for today])
```

### Journey 2 — Staff: Add a New Booking from OTA Screenshot

```mermaid
flowchart TD
    A([Receive booking notification from OTA]) --> B([Take screenshot of booking details])
    B --> C([Open hotel app on phone])
    C --> D([Click New Booking])
    D --> E([Drop screenshot into upload zone])
    E --> F([AI extracts guest name, dates, price])
    F --> G([Review auto-filled form fields])
    G --> H([Select the correct room])
    H --> I([Verify details and click Save])
    I --> J([Booking appears in the list])
```

### Journey 3 — Housekeeping: Cleaning Workflow

```mermaid
flowchart TD
    A([Open app on phone]) --> B([Go to Cleaning Plan tab])
    B --> C([Filter by Checkout today])
    C --> D([See list of rooms to clean])
    D --> E([Change room status to In Progress])
    E --> F([Clean the room physically])
    F --> G([Change room status to Clean])
    G --> H{More rooms to clean?}
    H -->|Yes| D
    H -->|No| I([Filter by Check-in today])
    I --> J([Confirm all check-in rooms are marked Clean])
```

### Journey 4 — Owner: Monthly Reporting

```mermaid
flowchart TD
    A([Open Monthly Summary tab]) --> B([See occupancy % for each month])
    B --> C([Check gross room revenue])
    C --> D([Check OTA commissions deducted])
    D --> E([Check net room income])
    E --> F([Enter cafe income for the month])
    F --> G([Enter Grab and LINE MAN income])
    G --> H([Enter cooking class and vehicle income])
    H --> I([Total monthly income auto-calculated])
```

---

## Project Structure

```
/
├── src/
│   ├── app/
│   │   ├── layout.tsx                Root layout (fonts, Supabase provider)
│   │   ├── page.tsx                  Redirect → /dashboard
│   │   ├── login/
│   │   │   └── page.tsx              Email + password login form
│   │   ├── dashboard/
│   │   │   └── page.tsx              Metric cards, weekly grid, room status
│   │   ├── day-guest/
│   │   │   └── page.tsx              Room × date grid
│   │   ├── bookings/
│   │   │   └── page.tsx              Full booking list with filters
│   │   ├── cleaning/
│   │   │   └── page.tsx              Room cleaning status table
│   │   ├── shifts/
│   │   │   └── page.tsx              Staff weekly rota
│   │   ├── monthly/
│   │   │   └── page.tsx              Monthly income summary
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           Nav links, logo, date badge
│   │   │   └── Topbar.tsx            Page title, + New Booking button
│   │   ├── bookings/
│   │   │   ├── BookingModal.tsx      New / edit booking form
│   │   │   └── ScreenshotUpload.tsx  Drag-and-drop upload zone
│   │   ├── dashboard/
│   │   │   ├── MetricCards.tsx       6 stat cards
│   │   │   ├── WeeklyGrid.tsx        7-day occupancy grid
│   │   │   └── OccupancyByRoom.tsx   Per-room guest dots
│   │   └── ui/
│   │       ├── Badge.tsx             Room type, status, source badges
│   │       └── StatusDropdown.tsx    Inline clean status selector
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             Browser Supabase client
│   │   │   └── server.ts             Server Supabase client (API routes)
│   │   ├── constants.ts              ROOMS, ROOM_TYPES, OCC_ROOMS, SOURCES
│   │   └── helpers.ts                fmtDate, fmtMoney, calcNights, isStayingOn
│   │
│   └── middleware.ts                 Auth session check on all routes
│
├── .env.local                        Local secrets (never committed)
│                                     Includes SUPABASE_SERVICE_ROLE_KEY for /new-booking skill
├── .env.example                      Template with key names only
├── tailwind.config.ts                Design tokens (colors, fonts)
├── next.config.ts                    Next.js config
└── .claude/commands/
    └── new-booking.md                /new-booking slash command for screenshot intake
```

---

## Milestones & Working Packages

### Overview

```mermaid
gantt
    title Himmapun Retreat App — Build Milestones
    dateFormat  YYYY-MM-DD
    section M0 · Setup
        Node.js install          :m0a, 2026-03-18, 1d
        Supabase project         :m0b, after m0a, 1d
        GitHub + Vercel connect  :m0c, after m0b, 1d
    section M1 · Foundation
        Scaffold Next.js         :m1a, after m0c, 1d
        Auth + middleware        :m1b, after m1a, 1d
        Layout shell             :m1c, after m1b, 1d
    section M2 · Core Bookings
        Bookings list + filters  :m2a, after m1c, 2d
        New / Edit modal         :m2b, after m2a, 2d
        Cleaning Plan            :m2c, after m2b, 1d
    section M3 · Dashboard
        Dashboard metrics        :m3a, after m2c, 2d
        Day Guest Overview       :m3b, after m3a, 1d
        Staff Shifts             :m3c, after m3b, 1d
    section M4 · AI + Monthly
        Screenshot API route     :m4a, after m3c, 1d
        Monthly Summary page     :m4b, after m4a, 2d
    section M5 · Polish
        Mobile QA                :m5a, after m4b, 1d
        Data migration           :m5b, after m5a, 1d
        Staff UAT                :m5c, after m5b, 2d
```

---

### M0 — Infrastructure Setup
**Goal:** All external services created and connected before any code is written.

| # | Task | How |
|---|------|-----|
| M0.1 | Install Node.js | See [Setup Instructions → Step 1](#step-1-install-nodejs) |
| M0.2 | Create Supabase project | See [Setup Instructions → Step 2](#step-2-create-supabase-project) |
| M0.3 | Create Vercel account + connect GitHub repo | See [Setup Instructions → Step 3](#step-3-connect-vercel) |
| M0.4 | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` | See [Setup Instructions → Step 4](#step-4-configure-environment-variables) |

**Done when:** `node -v` returns a version, Supabase project exists, Vercel is connected to the GitHub repo, and `.env.local` contains both Supabase keys.

---

### M1 — Foundation
**Goal:** A running Next.js app deployed on Vercel with login working.

| # | Task |
|---|------|
| M1.1 | Scaffold Next.js project in repo root |
| M1.2 | Configure Tailwind with design tokens (colors, fonts) |
| M1.3 | Install Supabase + Anthropic packages |
| M1.4 | Create Supabase DB tables + RLS policies (copy SQL from this doc) |
| M1.5 | Create `.env.local` with Supabase + Anthropic keys |
| M1.6 | Build login page (`/login`) |
| M1.7 | Add `middleware.ts` to protect all routes |
| M1.8 | Build sidebar + topbar layout shell |
| M1.9 | Deploy to Vercel + add env vars in Vercel dashboard |
| M1.10 | Create first staff account in Supabase Auth dashboard |

**Done when:** Staff can log in at the Vercel URL, see the layout shell, and log out.

---

### M2 — Core Booking Features
**Goal:** Staff can create, view, edit, delete bookings and update clean status.

| # | Task |
|---|------|
| M2.1 | All Bookings page — table with all rows from Supabase |
| M2.2 | Status, room, source filter dropdowns |
| M2.3 | Date range filter (overlap logic) |
| M2.4 | "+ New Booking" modal — manual entry form |
| M2.5 | Auto-calculate nights + net income on form |
| M2.6 | Save new booking to Supabase |
| M2.7 | Edit existing booking (pre-fill modal) |
| M2.8 | Delete booking with confirmation |
| M2.9 | Cleaning Plan page — all 12 rooms always shown |
| M2.10 | Inline clean status dropdown — updates Supabase immediately |

**Done when:** A booking can be created, edited, deleted, and its clean status updated — all reflected in Supabase.

---

### M3 — Dashboard & Views
**Goal:** The three read-heavy views are working with live data.

| # | Task |
|---|------|
| M3.1 | Dashboard — 6 metric cards (occupancy, guests, check-ins, checkouts, gross, net) |
| M3.2 | Dashboard — "Checking in today" cards |
| M3.3 | Dashboard — "Checking out today" cards |
| M3.4 | Dashboard — Upcoming check-ins table (next 7 days) |
| M3.5 | Dashboard — Weekly occupancy grid (OCC_ROOMS only) |
| M3.6 | Dashboard — Income summary + source breakdown |
| M3.7 | Dashboard — Occupancy by room (guest dots) |
| M3.8 | Day Guest Overview — room × date grid with date selector |
| M3.9 | Staff Shifts — today's shift cards + weekly rota table |

**Done when:** The dashboard reflects live Supabase data and all three pages render correctly on mobile.

---

### M4 — Monthly Summary & Slash Command
**Goal:** Monthly report is complete and the `/new-booking` slash command is tested end-to-end.

| # | Task |
|---|------|
| M4.1 | Monthly Summary page — room income columns from bookings |
| M4.2 | Monthly other income columns — manually entered per month |
| M4.3 | Totals row at bottom of monthly table |
| M4.4 | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` |
| M4.5 | Test `/new-booking` with a real OTA screenshot |
| M4.6 | Verify the inserted booking appears correctly in the app |

**Done when:** Monthly summary shows correct occupancy % and totals, and pasting a screenshot and typing `/new-booking` successfully saves a booking to Supabase.

---

### M5 — Polish, Migration & Launch
**Goal:** App is production-ready and all Google Sheets data is imported.

| # | Task |
|---|------|
| M5.1 | Mobile responsive QA — test all pages on iPhone |
| M5.2 | Export bookings from Google Sheets as CSV |
| M5.3 | Clean CSV — map columns to DB schema, fix date formats |
| M5.4 | Import CSV via Supabase dashboard |
| M5.5 | Verify row counts + spot-check data |
| M5.6 | Create all staff accounts in Supabase Auth |
| M5.7 | User acceptance testing with staff |
| M5.8 | Fix any bugs found during UAT |

**Done when:** All staff can log in, existing booking history is visible, and the app is the primary tool replacing Google Sheets.

---

## Setup Instructions

### Step 1: Install Node.js

Node.js is the runtime required to run the project locally.

**Option A — via nvm (recommended for Mac):**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Close and reopen your terminal, then:
nvm install --lts

# Verify — both should print version numbers
node -v
npm -v
```

**Option B — direct installer:**
Go to https://nodejs.org → download the **LTS** version for macOS → run the `.pkg` installer.

---

### Step 2: Create Supabase Project

1. Go to https://supabase.com and sign up (free)
2. Click **New Project**
3. Fill in:
   - **Name:** `himmapun-retreat`
   - **Database password:** choose a strong password and save it somewhere safe
   - **Region:** Southeast Asia (Singapore) — closest to Chiang Mai
4. Click **Create new project** and wait ~2 minutes for provisioning
5. Once ready, go to **Project Settings → API**
6. Copy and save these two values — you will need them later:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public key** (long string starting with `eyJ...`)
7. Go to **SQL Editor** in the sidebar
8. Paste and run the three `CREATE TABLE` + `ALTER TABLE` (RLS) SQL blocks from the [Database Design](#database-design) section above
9. Verify the three tables appear under **Table Editor**

---

### Step 3: Connect Vercel

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New → Project**
3. Find and select the `expample` GitHub repository
4. Under **Framework Preset**, select **Next.js** (auto-detected)
5. Do **not** deploy yet — click **Environment Variables** first
6. Add these two variables (from Supabase → Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL       = (your Supabase Project URL)
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = (your Supabase anon key)
   ```
   Note: `SUPABASE_SERVICE_ROLE_KEY` is **not** added to Vercel — it lives only in `.env.local` on your machine for the `/new-booking` slash command.
7. Click **Deploy** — the first deploy will fail (no Next.js app yet), that is fine
8. Note your app URL (e.g. `https://expample.vercel.app`) — this is where the app will live

---

### Step 4: Get Supabase Service Role Key

This key is only needed for the `/new-booking` slash command on your local machine — it is never added to Vercel.

1. Go to your Supabase project dashboard
2. Click **Project Settings → API**
3. Under **Project API keys**, find the `service_role` key (marked "secret")
4. Copy it — add it to `.env.local` in Step 6 as `SUPABASE_SERVICE_ROLE_KEY`

> **Important:** This key bypasses Row Level Security. Never commit it to git. Never add it to Vercel.

---

### Step 5: Scaffold the Next.js Project

From the repo root in your terminal:

```bash
# Create the Next.js app (answer "Yes" to all prompts)
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git

# Install Supabase packages
npm install @supabase/supabase-js @supabase/ssr
```

---

### Step 6: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# .env.local — never commit this file
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # for /new-booking slash command only
```

Also create a `.env.example` file (safe to commit — no real values):

```bash
# .env.example — copy to .env.local and fill in your values
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Make sure `.env.local` is in `.gitignore` (Next.js adds it by default).

---

### Step 7: Run Locally

```bash
npm run dev
```

Open http://localhost:3000 — you should see the Next.js default page.

---

### Step 8: Create Staff Accounts in Supabase

1. Go to your Supabase project dashboard
2. Click **Authentication → Users** in the sidebar
3. Click **Invite user** (or **Add user**)
4. Enter the staff member's email and a temporary password
5. Repeat for each staff member
6. Staff can change their password after first login (or you can set it manually)

---

### Step 9: Push and Auto-Deploy

```bash
git add .
git commit -m "Initial Next.js scaffold"
git push origin main
```

Vercel will automatically detect the push and deploy. Check the **Deployments** tab in Vercel for build logs. After ~1 minute the live URL will be updated.

---

## Decisions Log

| Question | Answer |
|----------|--------|
| Staff email format | Any email — defined per person when creating accounts |
| Staff account management | Via Supabase Auth dashboard — no in-app admin screen needed |
| Google Sheets migration | Deferred to M5 — start with clean database |
| Real-time sync | Not needed — page refresh is acceptable |
| Self-signup | Disabled — owner creates accounts manually in Supabase |
