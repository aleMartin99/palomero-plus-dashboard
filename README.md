# Palomero Plus — Super Admin Dashboard

React + TypeScript + [Ant Design](https://ant.design) admin dashboard, built with Vite.

## Login & roles

The dashboard is gated behind a real login. There is no shared password: each person signs in
with their own Supabase Auth account, and the Edge Function decides what they're allowed to do
based on their email.

| | Owner | Viewer |
|---|---|---|
| Overview | ✅ | ✅ |
| Users (view) | ✅ | ✅ |
| Users — ban / reactivate | ✅ | ❌ |
| Contact Requests | ✅ | ❌ (tab hidden) |
| Subscriptions | ✅ | ❌ (tab hidden) |

**Roles are enforced server-side.** `src/lib/roles.ts` decides what the UI *shows*;
`supabase/functions/admin-dashboard-api/index.ts` is what actually *refuses* the request. A
viewer's `getAll` response doesn't even contain contact-request data, and `banUser` /
`updateContactStatus` return 403 for them regardless of what the browser sends. If you change a
permission, change it in **both** files.

Being a valid Palomero Plus app user is *not* dashboard access — the email must also be on the
`ADMIN_ROLES` allowlist, or the function returns 403.

### Setup (one-time)

**1. Create an auth account for each person** (if they don't already have one) — Supabase
dashboard → Authentication → Users → *Add user*. Use "Auto Confirm User" so they can sign in
right away. Dedicated admin addresses are fine; so are your existing app accounts.

**2. Set the allowlist secret** — this maps email → role and is the only place roles live:

```bash
supabase secrets set \
  ADMIN_ROLES='{"you@example.com":"owner","partner@example.com":"viewer"}' \
  --project-ref uhetvehxmnexfkxpenfi
```

Valid roles are `owner` and `viewer`. Emails are matched case-insensitively. To change who has
access — or to revoke someone — update this secret; no code change or redeploy needed.

**3. Deploy the function:**

```bash
supabase functions deploy admin-dashboard-api --project-ref uhetvehxmnexfkxpenfi
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't set them by
hand. The old `ADMIN_DASHBOARD_KEY` secret is no longer used and can be deleted:
`supabase secrets unset ADMIN_DASHBOARD_KEY --project-ref uhetvehxmnexfkxpenfi`.

## Security model

- The browser bundle contains only the **public anon key** (safe to ship) — used solely to sign
  in and keep the session token fresh.
- Every data request carries the signed-in user's **JWT**. The Edge Function verifies it with
  `auth.getUser()`, which rejects the anon key, so holding the public key alone gets you nothing.
- The **service_role key** (full DB access, bypasses RLS) exists only inside the Edge Function's
  server-side environment and never reaches the browser.
- Ban / reactivate / contact-status changes are logged with the acting admin's email — check
  them with `supabase functions logs admin-dashboard-api`.

## Local development

```bash
npm install
npm run dev      # or: npm start
```

`.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (both public values). See
`.env.example` for the shape.

## Production build

```bash
npm run build     # outputs to dist/
npm run preview   # serve the production build locally to check it
```

## Data correctness notes

Two things that have bitten this dashboard before — worth knowing if numbers ever look wrong:

- **Pagination.** `auth.admin.listUsers()` defaults to 50 per page, and PostgREST caps every
  `.select()` at 1000 rows. Both silently truncate rather than erroring. The function pages
  through both (`fetchAllRows()` / the `listUsers` loop). **Any new table read must use
  `fetchAllRows`** — a table under 1000 rows today will break silently the day it crosses.
- **Pro entitlement.** Never count `status = 'active'` alone: rows whose `end_date` has passed
  still say `active`, and the app treats those users as free. `src/lib/helpers.ts →
  grantsProAccess()` mirrors the app's `Subscription.isPro` exactly (including the cancelled
  grace period and the date-only/midnight rule). Keep the two in sync.

## Project layout

```
src/
  components/   OverviewPage, UsersPage, ContactsPage, SubscriptionsPage, LoginPage
  hooks/        useAdminData — fetches everything via the Edge Function
  lib/          auth.tsx (session + role), roles.ts (permission matrix), api.ts,
                supabaseClient.ts, helpers.ts (entitlement rules), demoData.ts
  types/        shared TypeScript interfaces
supabase/functions/admin-dashboard-api/index.ts   the backend — auth, roles, and all DB access
```
