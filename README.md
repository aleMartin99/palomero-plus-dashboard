# Palomero Plus — Super Admin Dashboard

React + TypeScript + [Ant Design](https://ant.design) rebuild of the admin dashboard, built with Vite.

## What changed from the previous version

- **Stack**: was a single static `index.html` + `app.js` (Tailwind via CDN, vanilla JS DOM
  manipulation). Now a proper Vite + React + TypeScript app using Ant Design components
  (Table, Drawer, Card, Statistic, Segmented, `@ant-design/charts`, …).
- **Security**: the old dashboard asked the admin to paste the Supabase **service_role key**
  (full database access, bypasses every security rule) into a Settings modal, then stored it in
  `localStorage` and used it directly from the browser. That key is gone from the client
  entirely. Instead:
  - The browser only ever holds the public **anon/publishable key** (safe to ship — same as
    what already lived in the project's root `.env`) and a low-privilege **admin access key**
    (`x-admin-secret`) entered once via the Settings modal.
  - All privileged operations (listing auth users, reading every table, banning a user, updating
    a contact request) now go through a new Supabase Edge Function,
    `supabase/functions/admin-dashboard-api`, which is the only thing that touches the real
    `service_role` key — and only server-side.
  - This mirrors the `x-admin-secret` pattern already used by the `send-official-email` function
    in this project, with its own dedicated secret (`ADMIN_DASHBOARD_KEY`) rather than sharing
    one across functions.

## Local development

```bash
npm install
npm run dev      # or: npm start
```

`.env.local` already has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` filled in (both public
values, safe to commit-adjacent but kept in a `*.local` file out of git by convention). See
`.env.example` for the shape if you need to point at a different project.

With no admin access key configured yet, the dashboard runs on **demo data** automatically —
useful for UI work without touching the real database.

## Deploying the Edge Function (not done yet — do this before "Save & connect" will work for real)

1. Copy `supabase/functions/admin-dashboard-api/` into the `palomero_plus` repo's
   `supabase/functions/` directory (same place `send-official-email` and `validate-purchase`
   live).
2. Set the admin secret once:
   ```bash
   supabase secrets set ADMIN_DASHBOARD_KEY=<choose-a-long-random-value> --project-ref uhetvehxmnexfkxpenfi
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` don't need to be set manually — Supabase
   injects them into every Edge Function automatically.
3. Deploy:
   ```bash
   supabase functions deploy admin-dashboard-api --project-ref uhetvehxmnexfkxpenfi
   ```
4. In the dashboard, click the gear icon in the header and paste the same value you set for
   `ADMIN_DASHBOARD_KEY` as the "Admin access key". That's the only secret this app ever asks
   an admin to type in.

## Production build

```bash
npm run build     # outputs to dist/
npm run preview   # serve the production build locally to sanity-check it
```

## Project layout

```
src/
  components/   OverviewPage, UsersPage, ContactsPage, SubscriptionsPage, SettingsModal
  hooks/        useAdminData — fetches everything via the Edge Function, falls back to demo data
  lib/          api.ts (Edge Function client), adminSecret.ts, demoData.ts, helpers.ts
  types/        shared TypeScript interfaces
supabase/functions/admin-dashboard-api/index.ts   the new backend, deploy separately (see above)
```
