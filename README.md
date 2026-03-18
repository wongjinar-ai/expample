# Himmapun Retreat — Hotel Operations App

A single-file hotel management web app for Himmapun Retreat in Chiang Mai, Thailand. Manages bookings, cleaning, staff shifts, and monthly income — with AI-powered booking intake via screenshot parsing using the Anthropic Claude API.

---

## Features

- **Dashboard** — Daily at-a-glance: occupancy, check-ins/outs, revenue, weekly grid, room status
- **Day Guest Overview** — Visual room-by-date grid showing all 12 rooms with guest and clean status
- **All Bookings** — Full booking database with filters by status, room, source, and date range
- **Cleaning Plan** — Room-by-room cleaning status, inline editable without opening the booking modal
- **Staff Shifts** — Weekly rota table and today's shift cards
- **Monthly Summary** — Occupancy %, room income, OTA commissions, and other income sources (cafe, Grab, LINE MAN, cooking class, vehicle rental)
- **AI Screenshot Parsing** — Drop a Booking.com / Agoda / Airbnb screenshot; Claude extracts guest name, dates, price, commission, and booking reference automatically

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
| Frontend | Vanilla HTML / CSS / JavaScript — single `index.html` |
| Persistence | Browser `localStorage` (`hm_bookings`) |
| Fonts | Google Fonts — Fraunces, DM Sans, DM Mono |
| AI | Anthropic Messages API (`claude-sonnet-4-20250514`) |
| Backend | None — fully client-side |

---

## Getting Started

### Prerequisites

- A modern browser (Chrome, Firefox, Safari, Edge)
- An [Anthropic API key](https://console.anthropic.com/) — only required for the AI screenshot parsing feature

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/wongjinar-ai/expample.git
   cd expample
   ```

2. Open `index.html` directly in your browser — no build step or server required.

### API Key Setup

The AI screenshot parsing feature calls the Anthropic API from the browser. Enter your API key in the app's settings field when prompted, or set it in the source:

```javascript
const ANTHROPIC_API_KEY = "your-api-key-here";
```

> **Note:** For production use, proxy API calls through a backend to avoid exposing your key in the browser.

---

## Usage

### Adding a Booking Manually
1. Click **+ New Booking** in the top bar.
2. Fill in guest name, room, check-in/out dates, source, and price.
3. Click **Save Booking**.

### Adding a Booking via Screenshot (AI)
1. Click **+ New Booking**.
2. Drag and drop (or click to browse) a booking screenshot from Booking.com, Agoda, or Airbnb.
3. Claude extracts guest name, dates, price, commission, and booking reference and fills the form automatically.
4. Select the room, verify the details, and click **Save Booking**.

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
7. The All Bookings date filter shows bookings that **overlap** the selected range, not just those starting within it.
8. Day Guest Overview always shows **all 12 rooms**, even when vacant.

---

## Data Model

### Booking

```typescript
interface Booking {
  id: number;
  guest: string;
  guest2: string;
  room: RoomName;
  type: 'Standard' | 'Tent' | 'Bungalow' | 'Extra';
  guests: number;
  checkin: string;           // YYYY-MM-DD
  checkout: string;          // YYYY-MM-DD
  nights: number;            // auto-calculated
  source: 'Direct' | 'Booking.com' | 'Agoda' | 'Airbnb' | 'Other';
  gross: number;             // total price charged (฿)
  comm: number;              // OTA commission (฿), entered manually
  netIncome: number;         // auto-calculated: gross - comm
  status: 'Upcoming' | 'Check-in' | 'Occupied' | 'Checkout' | 'Completed';
  cleanStatus: '🟢 Clean' | '🔴 Needs Cleaning' | '🟡 In Progress';
  special: string;
  tm30: boolean;
  bookingRef: string;
}
```

### Monthly Other Income

```typescript
interface MonthlyIncome {
  month: string;    // e.g. "Jan 2026"
  cafe: number;
  grab: number;
  lineman: number;
  cooking: number;
  vehicle: number;
}
```

---

## Design System

| Token | Value |
|-------|-------|
| Background | `#0e0f0e` |
| Surface | `#161815` |
| Surface 2 | `#1e201d` |
| Accent | `#c8e84a` |
| Text | `#e8ead5` |
| Text muted | `#9a9c8a` |
| Display font | Fraunces (serif) |
| Body font | DM Sans |
| Mono font | DM Mono |

---

## File Structure

```
index.html
├── <style>       CSS variables and all component styles
├── <body>
│   ├── .sidebar  Navigation, logo, date badge
│   ├── .main
│   │   ├── .topbar          Page title + New Booking button
│   │   └── .content
│   │       ├── #panel-dashboard
│   │       ├── #panel-dayguest
│   │       ├── #panel-bookings
│   │       ├── #panel-cleaning
│   │       ├── #panel-shifts
│   │       └── #panel-monthly
│   └── #booking-modal       Screenshot upload zone + form
└── <script>
    ├── Constants            ROOMS, ROOM_TYPES, OCC_ROOMS
    ├── Data                 bookings[], SHIFTS[], MONTHLY_OTHER{}
    ├── Helpers              fmtDate, fmtMoney, nights, badges
    ├── Render functions     one per panel
    ├── Modal functions      openModal, closeModal, saveBooking
    ├── handleScreenshot()   AI parsing via Anthropic API
    └── Init                 populateRoomFilter + renderDashboard
```

---

## License

<!-- Add license information here -->
