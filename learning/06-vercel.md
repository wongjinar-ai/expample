# Vercel — Hosting & Deployment for Beginners

## What is Vercel?

**Vercel** is a hosting platform that takes your Next.js code from GitHub and makes it available to anyone on the internet via a URL.

Without Vercel (or something similar), your app would only work on your own computer.

```mermaid
graph LR
    Local["Your Laptop\n(localhost:3000)"]
    GitHub["GitHub\n(code repository)"]
    Vercel["Vercel\n(public on the internet)"]
    Users["Anyone with a browser\n(your hotel staff)"]

    Local -->|"git push"| GitHub
    GitHub -->|"auto-deploy"| Vercel
    Vercel -->|"serves the app"| Users
```

---

## Why Vercel?

| What you need | How Vercel provides it |
|---------------|----------------------|
| A public URL for your app | Automatic — `your-app.vercel.app` |
| HTTPS (secure connection) | Automatic — included for free |
| Fast loading worldwide | CDN (content delivery network) built in |
| Auto-deploy when you push | Connected to GitHub — deploys on every push |
| Zero server management | No server to set up, patch, or maintain |

Vercel is purpose-built for Next.js (the same company made both), so compatibility is seamless.

---

## The Deployment Pipeline

Here is exactly what happens when you `git push`:

```mermaid
sequenceDiagram
    participant You as You (local machine)
    participant GitHub
    participant Vercel
    participant Staff as Hotel Staff (browser)

    You->>GitHub: git push origin main
    GitHub->>Vercel: Webhook: "new commit on main"
    Vercel->>Vercel: Pull the code
    Vercel->>Vercel: npm install (install packages)
    Vercel->>Vercel: npm run build (compile TypeScript)
    Vercel->>Vercel: Deploy to global CDN
    Vercel-->>You: Build success — live URL updated

    Staff->>Vercel: Visit https://your-app.vercel.app
    Vercel-->>Staff: Serve the Next.js app
```

The whole process takes about 1–2 minutes.

---

## What is a CDN?

**CDN** stands for Content Delivery Network. Instead of your app running on one server in one location, Vercel copies it to servers all around the world.

```mermaid
graph TD
    Vercel["Your App on Vercel"]
    Vercel --> SGP["Server in Singapore"]
    Vercel --> USA["Server in USA"]
    Vercel --> EU["Server in Europe"]
    Vercel --> JP["Server in Japan"]

    Staff["Staff in Chiang Mai"] --> SGP
    Tourist["Tourist booking from Germany"] --> EU
```

The user gets served by the nearest server — so the app loads fast regardless of where they are.

---

## Setting Up Vercel (Step by Step)

```mermaid
flowchart TD
    A([Go to vercel.com]) --> B([Sign up with GitHub])
    B --> C([Click Add New Project])
    C --> D([Select your GitHub repo])
    D --> E([Vercel detects Next.js automatically])
    E --> F([Add Environment Variables])
    F --> G([Click Deploy])
    G --> H{Build passes?}
    H -->|Yes| I([Your app is live!])
    H -->|No| J([Read build logs])
    J --> K([Fix the error])
    K --> G
```

---

## Environment Variables on Vercel

Your app needs secret keys (like the Supabase URL and anon key) to work. On your laptop, these live in `.env.local`. On Vercel, you add them manually in the dashboard.

```mermaid
graph LR
    Local[".env.local\n(on your laptop)"]
    VercelDash["Vercel Dashboard\nProject → Settings → Env Vars"]
    VercelRuntime["Vercel Runtime\n(app reads these when running)"]

    Local -->|"copy values manually"| VercelDash
    VercelDash -->|"injected at build & runtime"| VercelRuntime
```

**What goes to Vercel:**

| Variable | Add to Vercel? | Why |
|----------|---------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | App needs to connect to Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | App needs to query the database |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | This is only for `/new-booking` on your laptop — never on Vercel |

**Important:** The `NEXT_PUBLIC_` prefix means the variable is safe to expose to the browser. Variables WITHOUT that prefix are server-side only.

---

## Preview Deployments

Every time you push to a branch (not just `main`), Vercel creates a **preview deployment** — a temporary URL to test your changes before they go live.

```mermaid
gitGraph
    commit id: "Stable production"

    branch feature/new-filter
    checkout feature/new-filter
    commit id: "Add filter" type: HIGHLIGHT

    checkout main
    commit id: "Other work"
```

- `main` branch → `https://your-app.vercel.app` (production — what staff use)
- `feature/new-filter` branch → `https://your-app-git-feature-new-filter.vercel.app` (preview — just for testing)

---

## Reading Build Logs

When a deployment fails, Vercel shows you the build logs. Here is how to read them:

```
[00:12] npm install
[00:45] npm run build
[00:47] ▲ Next.js 15.0.0
[00:48] Creating an optimized production build...
[01:12] ✓ Compiled successfully
[01:12] Route (app)     Size
[01:12] ├ ○ /dashboard  4.2 kB
[01:12] └ ○ /bookings   3.8 kB
[01:12] ✓ Build completed
```

If there is an error:
```
[00:52] Type error: Property 'grss' does not exist on type 'Booking'
[00:52]   at src/app/dashboard/page.tsx:34
```

Go to `dashboard/page.tsx` line 34 and fix the typo (`grss` → `gross`).

---

## Vercel Dashboard Overview

```mermaid
mindmap
  root((Vercel Dashboard))
    Projects
      Your app
      Deployments list
      Build logs
    Settings
      Environment Variables
      Domain name
      GitHub connection
    Analytics
      Page views
      Performance scores
    Functions
      API route logs
      Edge function logs
```

The most useful pages:
1. **Deployments** — see every deploy and its status
2. **Settings → Environment Variables** — manage your secrets
3. **Build logs** — debug failed deployments

---

## Custom Domain (Optional)

By default your app is at `yourapp.vercel.app`. You can connect a custom domain (e.g. `hotel.himmapunretreat.com`) in:

Vercel Dashboard → Project → Settings → Domains → Add Domain

Then update your domain's DNS settings (at your domain registrar) to point to Vercel.

---

## Summary

```mermaid
flowchart LR
    Code["Write code"] --> Push["git push to GitHub"]
    Push --> Auto["Vercel auto-deploys\n(~1 minute)"]
    Auto --> Live["App is live at your URL"]
    Live --> Staff["Staff access it anywhere"]
```

Vercel removes the complexity of servers, HTTPS certificates, and deployment pipelines. You write code, push to GitHub, and it is live. That is the entire workflow.
