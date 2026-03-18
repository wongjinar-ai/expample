# Himmapun Branding Guide

Use this guide whenever working on any frontend, UI, or design-related task for the Himmapun Retreat hotel management app.

---

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#4b00a5` | Main brand purple — sidebar background, primary buttons, active states |
| Secondary | `#ff87ff` | Pink/magenta accent — highlights, hover states, accent2 |
| Dark bg | `#0d0b12` | App background |
| Surface | `#1a1525` | Cards, panels |
| Surface2 | `#241e32` | Inputs, nested surfaces |
| Text | `#f0edf6` | Primary text |
| Muted | `#9b8fb0` | Secondary text, labels |

### CSS Variables (globals.css)

```css
:root {
  --bg:      #0d0b12;
  --surface: #1a1525;
  --surface2:#241e32;
  --accent:  #4b00a5;   /* PRIMARY brand purple */
  --accent2: #ff87ff;   /* SECONDARY pink */
  --text:    #f0edf6;
  --muted:   #9b8fb0;

  --blue:    #60a5fa;
  --green:   #4ade80;
  --amber:   #fbbf24;
  --red:     #f87171;
  --pink:    #ff87ff;
}
```

---

## Logo

- **File**: `public/himmapun-logo.png`
- **Description**: White "Himmapun" script lettering with a decorative Thai-style frog inside an oval, on a deep purple background
- **Usage**: Use the white-on-purple version on dark/purple backgrounds. The logo is always white; never recolor it.
- **In app**: Use as `<img src="/himmapun-logo.png" alt="Himmapun" />` or as a Next.js `<Image>` component

For the sidebar logo area, display the logo image instead of the 🐸 emoji.

---

## Typography

| Font | Variable | Usage |
|------|----------|-------|
| Fraunces | `var(--font-fraunces)` | Display headings, brand name |
| DM Sans | `var(--font-dm-sans)` | Body text, UI labels |
| DM Mono | `var(--font-dm-mono)` | Data, numbers, dates, codes |

All fonts loaded from Google Fonts in `src/app/layout.tsx`.

---

## Design Principles

1. **Dark theme only** — never add light mode. Background is always deep near-black (`#0d0b12`).
2. **Purple is the brand** — `#4b00a5` is the primary accent. Use it for: sidebar bg, primary buttons, active nav states.
3. **Pink is the highlight** — `#ff87ff` for hover effects, focus rings, secondary accents.
4. **White on purple** — logo and sidebar text are always white (`#ffffff`) against the purple sidebar.
5. **Rounded corners** — use `rounded-xl` (12px) for cards/buttons, `rounded-2xl` (16px) for large containers.
6. **Subtle borders** — use `#2e2040` or `#3a2d50` for card/input borders — just enough to define edges.
7. **Thai natural feel** — minimal, clean, no heavy gradients. Inspired by a natural retreat.

---

## Key Components

- **Sidebar**: `var(--accent)` (#4b00a5) background, white text, Himmapun logo at top
- **Active nav link**: `rgba(255,255,255,0.15)` background highlight
- **Primary button**: `var(--accent)` background, white text
- **Input fields**: `var(--surface2)` background, `#3a2d50` border, `var(--accent2)` focus ring
- **Cards/panels**: `var(--surface)` background, `#2e2040` border

---

## Reference

- Website: https://himmapun.com (check for additional brand inspiration)
- Logo file: `public/himmapun-logo.png`
- Current globals: `src/app/globals.css`
- Sidebar: `src/components/layout/Sidebar.tsx`
- Login page: `src/app/login/page.tsx`
