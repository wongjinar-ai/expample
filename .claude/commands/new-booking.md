The user has pasted a booking screenshot. Follow these steps exactly.

---

## Step 1 — Extract fields from the image

Look at the screenshot and extract every field you can identify:

| Field | Expected format | Notes |
|-------|----------------|-------|
| guest | Full name | Primary guest |
| checkin | YYYY-MM-DD | |
| checkout | YYYY-MM-DD | |
| guests | Integer 1–6 | Number of guests |
| source | Direct / Booking.com / Agoda / Airbnb / Other | Detect from logo or channel name |
| gross | Integer (Thai Baht, no decimals) | Total price charged to guest |
| comm | Integer (Thai Baht, no decimals) | OTA commission — use 0 if not shown |
| booking_ref | String | OTA reference number — leave blank if not visible |
| special | String | Any notes or special requests — leave blank if none |

Fields that cannot come from a screenshot (ask the user):
- **room** — must be selected from: ม่วง, ชมพู, ขาว, Tent 1, Tent 2, Tent 3, Tent 4, Bungalow 1, Bungalow 2, Bungalow 3, Extra 1, Extra 2
- **guest2** — second guest name (ask only if relevant)

---

## Step 2 — Calculate derived fields

- **nights** = checkout − checkin (integer, number of days)
- **net_income** = gross − comm
- **type** = derived from room name:
  - ม่วง, ชมพู, ขาว → Standard
  - Tent 1–4 → Tent
  - Bungalow 1–3 → Bungalow
  - Extra 1–2 → Extra

---

## Step 3 — Show confirmation table

Present all fields in a clear markdown table like this:

| Field | Extracted Value |
|-------|----------------|
| Guest | ... |
| Room | ⚠️ Please select |
| Type | (auto from room) |
| Guests | ... |
| Check-in | ... |
| Check-out | ... |
| Nights | ... |
| Source | ... |
| Gross | ฿... |
| Commission | ฿... |
| Net Income | ฿... |
| Status | Upcoming |
| Clean Status | 🟢 Clean |
| Booking Ref | ... |
| Special | ... |
| TM30 | false |

Mark any field you could not extract with ⚠️.

Then ask:
1. Which room to assign (show the full list)
2. Whether any other field needs correction
3. "Type **confirm** to save this booking, or tell me what to change."

Wait for the user to respond before proceeding.

---

## Step 4 — Insert into Supabase

Once the user confirms, load the Supabase credentials and insert the booking.

First, load credentials from `.env.local`:

```bash
set -a && source .env.local && set +a
echo "URL: $NEXT_PUBLIC_SUPABASE_URL"
```

Then insert using curl. Build the JSON carefully — all string values must be properly quoted, integers must not be quoted:

```bash
set -a && source .env.local && set +a
curl -s -X POST \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bookings" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "guest": "GUEST_NAME",
    "guest2": "",
    "room": "ROOM",
    "type": "TYPE",
    "guests": GUESTS_INT,
    "checkin": "YYYY-MM-DD",
    "checkout": "YYYY-MM-DD",
    "nights": NIGHTS_INT,
    "source": "SOURCE",
    "gross": GROSS_INT,
    "comm": COMM_INT,
    "net_income": NET_INT,
    "status": "Upcoming",
    "clean_status": "🟢 Clean",
    "special": "SPECIAL",
    "tm30": false,
    "booking_ref": "BOOKING_REF"
  }'
```

Replace every placeholder with the confirmed values before running.

---

## Step 5 — Confirm success

If the curl response contains an `id` field, show:

> Booking saved. ID: `{id}` — **{guest}** in **{room}**, {checkin} → {checkout}.

If the response contains an error, show the full error message and do not retry automatically — ask the user how to proceed.

---

## Setup requirement (first time only)

The `.env.local` file must contain these two variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The service role key is found in Supabase dashboard → Project Settings → API → `service_role` (secret). This key bypasses Row Level Security and must never be committed to git. Confirm `.env.local` is listed in `.gitignore` before saving it.
