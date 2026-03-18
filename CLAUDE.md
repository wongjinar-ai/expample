# CLAUDE.md — Himmapun Retreat Hotel Operations App

## Project Summary

Single-file hotel management web app (`index.html`) for Himmapun Retreat, Chiang Mai, Thailand. No framework, no bundler, no backend. All state lives in browser `localStorage`. AI booking intake uses the Anthropic Messages API.

---

## File Structure

Everything is in one file: `index.html`

```
index.html
├── <style>        All CSS (variables, components, layout)
├── <body>
│   ├── .sidebar   Nav links + logo + live date badge
│   ├── .main
│   │   ├── .topbar              Page title + "+ New Booking" button
│   │   └── .content
│   │       ├── #panel-dashboard
│   │       ├── #panel-dayguest
│   │       ├── #panel-bookings
│   │       ├── #panel-cleaning
│   │       ├── #panel-shifts
│   │       └── #panel-monthly
│   └── #booking-modal           Screenshot upload zone + booking form
└── <script>
    ├── Constants      ROOMS[], ROOM_TYPES{}, OCC_ROOMS[], SOURCES[]
    ├── State          bookings[], SHIFTS[], MONTHLY_OTHER{}
    ├── Helpers        fmtDate(), fmtMoney(), calcNights(), badge helpers
    ├── renderDashboard()
    ├── renderDayGuest()
    ├── renderBookings()
    ├── renderCleaning() + updateClean()
    ├── renderShifts()
    ├── renderMonthly()
    ├── openModal() / closeModal() / saveBooking()
    ├── handleScreenshot()    Anthropic API call for AI parsing
    └── Init                  populateRoomFilter() + renderDashboard()
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

- Key: `localStorage.getItem('hm_bookings')`
- Format: JSON array of Booking objects
- Save on every create, edit, delete, and clean status change
- No migration layer — changes to the Booking shape must handle missing fields gracefully with defaults

---

## Booking Object Shape

```typescript
interface Booking {
  id: number;              // auto-increment
  guest: string;
  guest2: string;          // optional second guest
  room: string;            // must be one of ROOMS[]
  type: 'Standard' | 'Tent' | 'Bungalow' | 'Extra';  // derived from ROOM_TYPES
  guests: number;          // 1–6
  checkin: string;         // YYYY-MM-DD
  checkout: string;        // YYYY-MM-DD
  nights: number;          // auto-calculated
  source: 'Direct' | 'Booking.com' | 'Agoda' | 'Airbnb' | 'Other';
  gross: number;           // ฿
  comm: number;            // ฿, from OTA statement
  netIncome: number;       // auto-calculated
  status: 'Upcoming' | 'Check-in' | 'Occupied' | 'Checkout' | 'Completed';
  cleanStatus: '🟢 Clean' | '🔴 Needs Cleaning' | '🟡 In Progress';
  special: string;
  tm30: boolean;
  bookingRef: string;      // OTA reference, optional
}
```

---

## AI Screenshot Parsing

- **Endpoint:** `POST https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-20250514`
- **Auth header:** `x-api-key` (browser-side call)
- **Input:** base64-encoded image + extraction prompt
- **Output:** JSON object with fields: `guest, checkin, checkout, guests, source, gross, comm, booking_number, special`
- The form is auto-filled from the response; user must still select the room manually
- Handle parse failures gracefully — show error state in upload zone, allow manual entry

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

Each panel has a dedicated render function. `showPanel(id)` hides all panels, shows the target, updates nav state, and calls the render function. Render functions read from `bookings[]` and write HTML directly via `innerHTML` or `insertAdjacentHTML`. There is no virtual DOM or diffing — re-render the whole section on any data change.

---

## Coding Conventions

- No external JS libraries or frameworks — vanilla JS only
- All CSS in the single `<style>` block; no external stylesheets beyond Google Fonts
- Use `const` and `let`; no `var`
- Date strings are always `YYYY-MM-DD`; use `new Date(dateStr + 'T00:00:00')` to avoid timezone shifts when parsing
- Money values are integers (฿, no decimals)
- IDs auto-increment: `Math.max(0, ...bookings.map(b => b.id)) + 1`
- Always re-render the dashboard after any booking mutation so metric cards stay in sync
