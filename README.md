# Himmapun Retreat — Hotel Operations App

A web app for managing hotel operations at Himmapun Retreat, Chiang Mai, Thailand. Built with Next.js and Supabase. Staff access it from any device via a Vercel URL.

AI-powered booking intake is handled via a Claude Code slash command (`/new-booking`) — paste a screenshot from Booking.com, Agoda, or Airbnb directly into Claude Code and it extracts the details and saves the booking to the database automatically.

---

## Features

- **Dashboard** — Daily at-a-glance: occupancy, check-ins/outs, revenue, weekly grid, room status
- **Day Guest Overview** — Visual room-by-date grid showing all 12 rooms with guest and clean status
- **All Bookings** — Full booking database with filters by status, room, source, and date range
- **Cleaning Plan** — Room-by-room cleaning status, inline editable without opening a modal
- **Staff Shifts** — Weekly rota table and today's shift cards
- **Monthly Summary** — Occupancy %, room income, OTA commissions, and other income sources (cafe, Grab, LINE MAN, cooking class, vehicle rental)
- **`/new-booking` slash command** — Paste an OTA screenshot into Claude Code; Claude extracts guest name, dates, price, commission, and booking reference and saves it directly to the database

---

## Property

| Detail | Value |
|--------|-------|
| Property | Himmapun Retreat |
| Location | Chiang Mai, Thailand |
| Currency | Thai Baht (฿) |
| Total rooms | 12 (10 count toward occupancy) |
| Occupancy denominator | 300 room-nights/month (10 rooms × 30 days) |

### Room Inventory

| Room | Type | Max Guests | Counts in Occupancy |
|------|------|-----------|---------------------|
| ม่วง | Standard | 2 | Yes |
| ชมพู | Standard | 2 | Yes |
| ขาว | Standard | 2 | Yes |
| Tent 1–4 | Tent | 2 | Yes |
| Bungalow 1–3 | Bungalow | 3 | Yes |
| Extra 1–2 | Extra | 2 | No |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| Styling | TailwindCSS |
| Fonts | Google Fonts — Fraunces, DM Sans, DM Mono |
| AI booking intake | Claude Code `/new-booking` slash command (owner's machine only) |

---

## Getting Started

### Prerequisites

- Node.js LTS — install via `nvm install --lts` or from [nodejs.org](https://nodejs.org)
- A [Supabase](https://supabase.com) project (free tier)
- A [Vercel](https://vercel.com) account connected to this GitHub repo

### Installation

```bash
git clone https://github.com/wongjinar-ai/expample.git
cd expample
npm install
```

### Environment Variables

Create `.env` in the project root (never commit this file):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Usage

### Adding a Booking Manually
1. Click **+ New Booking** in the top bar.
2. Fill in guest name, room, check-in/out dates, source, and price.
3. Click **Save Booking**.

### Adding a Booking via Screenshot (Claude Code slash command)
1. Paste a screenshot from Booking.com, Agoda, or Airbnb into this Claude Code session.
2. Type `/new-booking`.
3. Claude extracts the details and shows a confirmation table.
4. Select the room, confirm or correct any field, type **confirm**.
5. Claude saves the booking directly to Supabase.

### Updating Clean Status
Open the **Cleaning Plan** tab and change the status dropdown inline — no modal required.

---

## Key Business Rules

1. Extra 1 and Extra 2 are **not counted** in occupancy % calculations.
2. Commission is entered as a fixed ฿ amount from the OTA statement — not calculated from a percentage.
3. **Net Income** = Gross − Commission (auto-calculated).
4. **Nights** = checkout date − check-in date (auto-calculated).
5. **Occupancy %** = occupied non-Extra rooms ÷ 10 × 100.
6. Monthly Rooms×Days denominator is fixed at **300** (10 rooms × 30 days).
7. The All Bookings date filter shows bookings that **overlap** the selected range.
8. Day Guest Overview always shows **all 12 rooms**, even when vacant.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              Root layout
│   ├── page.tsx                Redirect to /dashboard
│   ├── login/page.tsx          Login form
│   ├── dashboard/page.tsx
│   ├── day-guest/page.tsx
│   ├── bookings/page.tsx
│   ├── cleaning/page.tsx
│   ├── shifts/page.tsx
│   └── monthly/page.tsx
├── components/
│   ├── layout/                 Sidebar, Topbar
│   ├── bookings/               BookingModal
│   ├── dashboard/              MetricCards, WeeklyGrid, OccupancyByRoom
│   └── ui/                     Badge, StatusDropdown
├── lib/
│   ├── supabase/               client.ts, server.ts
│   ├── constants.ts            ROOMS, ROOM_TYPES, OCC_ROOMS
│   └── helpers.ts              fmtDate, fmtMoney, calcNights, isStayingOn
└── middleware.ts               Auth session guard

.claude/commands/
└── new-booking.md              Claude Code slash command for screenshot intake
```

---

## License

<!-- Add license information here -->
