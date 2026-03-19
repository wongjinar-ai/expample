# AI Auto-Fill Feature — Setup & Planning

## What This Feature Does

Two AI-powered auto-fill tools are already built into the booking modal:

| Feature | Where | What it does |
|---|---|---|
| **OTA Auto-fill** | Top of Edit Booking modal | Upload a Booking.com / Agoda / Airbnb screenshot → fills guest name, dates, gross, booking ref, special requests |
| **Passport OCR** | Per-guest "Passport" button | Upload a passport photo → fills passport number and name on passport |

Both call the **Claude Haiku 4.5** model via the Anthropic API. The API routes are:
- `src/app/api/extract-booking/route.ts` — OTA screenshot
- `src/app/api/extract-passport/route.ts` — Passport OCR

---

## Cost Estimate

Prices as of March 2026 (no VAT charged to Thailand):

| Tokens | Price |
|---|---|
| Input | $1.00 / 1M tokens (~฿34) |
| Output | $5.00 / 1M tokens (~฿170) |

**Per booking (OTA scan + 2 passport scans): ~$0.004 (~฿0.14)**

| Monthly bookings | Est. cost USD | Est. cost THB |
|---|---|---|
| 100 | ~$0.40 | ~฿14 |
| 300 | ~$1.20 | ~฿41 |
| 500 | ~$2.00 | ~฿68 |

---

## Step-by-Step: Get Your API Key

### Step 1 — Create an Anthropic account
1. Go to **console.anthropic.com**
2. Sign up with your email (Google login also works)
3. Verify your email

### Step 2 — Add a payment method
1. In the console, go to **Settings → Billing**
2. Click **Add payment method**
3. Enter your credit card details
4. You only get charged for what you use — no monthly fee

### Step 3 — Set a spending limit (important!)
1. In the console, go to **Settings → Limits**
2. Set a **Monthly spend limit** — recommended: **$5** (฿170)
   - This hard-caps your bill. The API will stop working if the limit is hit, not charge more.
3. Optionally set an **email alert** at $2 so you get warned before hitting the cap

### Step 4 — Generate an API key
1. Go to **Settings → API Keys**
2. Click **Create Key**
3. Give it a name, e.g. `himmapun-retreat`
4. Copy the key immediately — you can only see it once
5. Store it somewhere safe (e.g. your password manager) before the next steps

### Step 5 — Add the key to your local `.env` file
Open `/Users/macbookairm1/Documents/Github/expample/.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx
```

### Step 6 — Add the key to Vercel (for production)
1. Go to **vercel.com → your project → Settings → Environment Variables**
2. Click **Add**
3. Name: `ANTHROPIC_API_KEY`
4. Value: paste your key
5. Environments: check **Production**, **Preview**, **Development**
6. Click **Save**
7. **Redeploy** your app (Vercel → Deployments → click the three dots on the latest → Redeploy)

---

## Testing It Works

After setup, open the booking modal and:
1. Click **Choose image** at the top → upload any OTA booking screenshot → fields should auto-fill
2. Click the **Passport** button next to a guest → upload a passport photo → passport number and name should fill in

If it doesn't work, check:
- The key is correct (no extra spaces)
- The key has not hit its spending limit
- Vercel was redeployed after adding the env var

---

## Security Notes

- The API key lives only in `.env` (local) and Vercel's encrypted env vars — never in the browser or git
- `.env` is in `.gitignore` — it is never committed
- The Anthropic API only accepts calls from your server (Next.js API routes), not directly from users' browsers
- Passport photos are deleted automatically after 1 month via the `/api/cleanup-passports` cron job
