# Sevent — Deployment Handoff

You are deploying **Sevent** to a VPS owned by the user. Domain is exposed via a Cloudflare Tunnel (`cloudflared`) that is already running. This doc is the single source of truth — follow it top-to-bottom.

---

## 1. Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, RSC, Server Actions) — webpack, not turbopack |
| Language | TypeScript strict |
| Auth + DB + Storage | **Self-hosted Supabase** via `supabase` CLI (Docker Compose under the hood) |
| Postgres | 15 |
| Node | 20+ |
| Package manager | **pnpm 10** (do not use npm or yarn) |
| UI | Tailwind v4 + shadcn/ui + lucide-react |
| i18n | next-intl (cookie-based locale, no URL prefix) |
| Map | Leaflet + CartoDB tiles + OSM Nominatim reverse-geocode — no API keys |

Repo: `github.com/ahmadra2002KFU/Sevent` (the user will push before handoff).

---

## 2. VPS prerequisites

Install once:

```bash
# Docker + compose (official)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # log out/in after

# Node 20 + pnpm
curl -fsSL https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.xz | sudo tar -xJ -C /opt
sudo ln -sf /opt/node-v20.18.0-linux-x64/bin/node /usr/local/bin/node
sudo ln -sf /opt/node-v20.18.0-linux-x64/bin/npm /usr/local/bin/npm
sudo npm install -g pnpm@10

# Supabase CLI (v2)
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

Verify: `docker --version && node --version && pnpm --version && supabase --version`.

Cloudflare Tunnel should be running as a systemd service (`cloudflared`). Confirm with `sudo systemctl status cloudflared`.

---

## 3. Cloudflare Tunnel routing

Two hostnames route through the tunnel — **you must verify both are configured in the `cloudflared` config** (`/etc/cloudflared/config.yml` or the dashboard):

| Hostname | Origin | What it is |
|---|---|---|
| `sevent.ahmadgh.ovh` | `http://localhost:3000` | Next.js app |
| `sevent-api.ahmadgh.ovh` | `http://localhost:54321` | Supabase Kong gateway (Auth + REST + Storage + Realtime) |

Studio (port 54323), Postgres (54322), and Inbucket (54324) stay localhost-only — do **not** expose. Admin ops go through the app or SSH + psql.

> The `supabase` CLI stack uses `54321` for the API gateway (not `8000` — that's the port used by the self-hosted docker-compose from the `supabase/supabase` repo, which is a different install method).

---

## 4. Clone + install

```bash
cd /opt
sudo mkdir -p sevent && sudo chown $USER sevent
cd sevent
git clone git@github.com:ahmadra2002KFU/Sevent.git .
pnpm install --frozen-lockfile
```

---

## 5. Start Supabase stack

```bash
pnpm db:start
```

This boots all containers. On first start it pulls images (~2 GB). Wait until it prints the `API URL`, `anon key`, `service_role key` etc. **Copy the `Publishable` and `Secret` keys — you need them in the next step.**

If the keys look like `sb_publishable_...` and `sb_secret_...`, they are the new-format keys. That's correct — the app reads those, not the legacy JWT-style anon/service keys.

---

## 6. `.env.local`

Create `/opt/sevent/.env.local`:

```bash
# Public — safe to ship to the browser
NEXT_PUBLIC_SUPABASE_URL=https://sevent-api.ahmadgh.ovh
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XXXXXXXXXXXXXXXXXX

# Server-only — NEVER prefix with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=sb_secret_XXXXXXXXXXXXXXXXXX

# Next.js
NEXT_PUBLIC_SITE_URL=https://sevent.ahmadgh.ovh

# Email — leave blank for pilot. Wire Resend later.
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Double-check that `NEXT_PUBLIC_SUPABASE_URL` is the **public Cloudflare hostname**, not `http://127.0.0.1:54321`. The browser calls Supabase directly, so it must resolve externally.

---

## 7. Run migrations + seed

The stack started with an empty DB. Apply migrations + seed categories/users:

```bash
pnpm exec supabase db reset     # runs every migration + seed.sql
pnpm seed                       # creates 1 admin + 2 organizers + 25 suppliers
```

**Admin login for the seeded admin** (see `scripts/seed-users.ts`):
- email: `admin@sevent.dev`
- password: check the script — it's a fixed one for dev

**Change the admin password immediately on first login** via Studio or SQL:

```sql
-- in `psql` connected as postgres superuser
UPDATE auth.users
SET encrypted_password = crypt('<new-strong-password>', gen_salt('bf'))
WHERE email = 'admin@sevent.dev';
```

Or simpler: sign up a fresh user via the app, then promote to admin:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = (
  SELECT id FROM auth.users WHERE email = 'you@yourdomain.com'
);
```

---

## 8. Build + run Next.js

**Use webpack, not turbopack** — the project is tested on webpack. The `--webpack` flag is in the scripts; do not override.

```bash
pnpm exec next build --webpack
```

Run with pm2 (simplest process manager):

```bash
sudo npm install -g pm2
pm2 start pnpm --name sevent -- start
pm2 save
pm2 startup                 # follow the printed instruction to enable on reboot
```

Or systemd unit at `/etc/systemd/system/sevent.service`:

```ini
[Unit]
Description=Sevent Next.js
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=<your-user>
WorkingDirectory=/opt/sevent
EnvironmentFile=/opt/sevent/.env.local
ExecStart=/usr/local/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now sevent`.

---

## 9. Key things to double-check after first deploy

Run through this list before telling the user it's live:

- [ ] `curl -I https://sevent.ahmadgh.ovh` returns 200 (landing page).
- [ ] `curl https://sevent-api.ahmadgh.ovh/rest/v1/` returns a Supabase REST JSON response (not a Cloudflare 502).
- [ ] Open `https://sevent.ahmadgh.ovh` in a browser — landing renders, hero + nav + logo, language switcher toggles EN/AR.
- [ ] Sign up a new user via the app. Confirm they can sign in **without clicking an email link** (email confirmations are disabled in `supabase/config.toml` — `enable_confirmations = false`).
- [ ] Sign in as admin → `/admin/dashboard` shows journey cards + seeded suppliers.
- [ ] Sign up as supplier → complete `/supplier/onboarding` (business info, doc upload, map picker + categories) → land on `/supplier/dashboard` with "We're reviewing your application" card.
- [ ] Admin approves → supplier dashboard flips to "Live" on refresh.
- [ ] Public `/s/[slug]` renders the approved supplier.
- [ ] Language toggle works on every signed-in page and the map/onboarding survives RTL.

---

## 10. Known quirks / non-obvious things

1. **`enable_confirmations = false`** in `supabase/config.toml` for the pilot. Anyone who signs up can use the app immediately. Before opening beyond the pilot cohort, flip this back to `true` and wire Resend.
2. **pnpm only.** The `pnpm-lock.yaml` is the source of truth. Do not switch to npm/yarn.
3. **No turbopack.** Build with `--webpack`. The `dev` script is `next dev --webpack`.
4. **Next.js 16** — server actions are used throughout. Service-role client (in `src/lib/supabase/server.ts`) is re-created per request via `createSupabaseServiceRoleClient()`. Do not cache globally.
5. **RLS is the primary authz boundary.** Every server action first `requireRole("…")` then uses the admin client to dodge known policy recursion. Do not bypass this pattern.
6. **Map tiles** (CartoDB) and **reverse-geocode** (Nominatim) are called from the **browser**, not the VPS. They are free with attribution; Nominatim has a 1 req/s policy — fine for onboarding cadence.
7. **Storage buckets** (`supplier-portfolio`, `supplier-docs`, `contracts`) are created by migration `20260504000000_storage_buckets.sql` — confirm they exist in Studio after `db reset`.
8. **Timezone**: Postgres stores everything in UTC; the app formats per the user's locale in the browser.
9. **Backups**: add a cron on the VPS to `pg_dump` the `postgres` DB nightly and copy off-box. Minimum:

    ```bash
    crontab -e
    # add:
    0 3 * * * docker exec supabase_db_sevent pg_dump -U postgres -d postgres | gzip > /root/sevent-$(date +\%F).sql.gz
    ```

---

## 11. If something breaks

| Symptom | Most likely cause |
|---|---|
| "Invalid API key" in browser console | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is wrong or not injected at build time. Rebuild. |
| Every API call returns 401 | Anon key mismatched between frontend and Kong. Verify both came from the **same** `supabase start` run. |
| "infinite recursion detected in policy for …" | A server action is using the user-scoped client for writes that need service-role. Look for a missing `requireRole()` + `admin.from(...)` pattern. |
| Map is squeezed into a corner | Leaflet measured before layout settled. `InvalidateSizeOnMount` in `LocationPicker.tsx` already fixes this on initial mount; if it regresses on resize, wrap in a `ResizeObserver`. |
| Cloudflare 502 on `sevent-api` | Tunnel route is pointing at the wrong local port. Should be `localhost:54321` (Supabase CLI Kong). |
| `next build` fails with EISDIR on webpack | exFAT-specific bug on Windows. Linux VPS should not see this. |

---

## 12. What to tell the user when done

1. URL: `https://sevent.ahmadgh.ovh`
2. Admin login + password (ask them to change immediately)
3. Confirm the 11 sanity-check items above are green
4. Remind: **email confirmations are off** for the pilot — re-enable before public launch

---

## 13. Next steps (not part of this deploy — note for the user)

- Wire Resend for transactional email; flip `enable_confirmations = true`.
- Add `pg_cron` job for soft-hold expiry sweep (Sprint 5 scope).
- Add Grafana/Uptime Kuma for basic monitoring if not already running on the VPS.
- Sprint 4 execution (quote engine + accept_quote_tx RPC + booking flow) — plan exists in `Claude Docs/plan.md`; **not** part of this deploy.

---

**End of handoff.** If anything here conflicts with what you see in the repo (commit history moves fast), the repo wins — flag the discrepancy to the user rather than guessing.
