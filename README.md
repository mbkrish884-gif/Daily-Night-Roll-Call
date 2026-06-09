# Night Roll Call — Geofenced Police Attendance & Duty Management

A production-ready, mobile-first web app for the **Night Platoon roll call at CAR Headquarters, Hyderabad**. PCs mark attendance from their phones at HQ; the system enforces a GPS geofence, auto-timestamps Present marks on the server, and gives the duty officer a live dashboard, reports, audit trail, and one-tap roster import.

---

## A. Architecture (short version)

A single **Next.js 14 (App Router)** application that serves both the public attendance form and the admin console, backed by one database through **Prisma**.

```
                     ┌──────────────────────────────────────────┐
   PC's phone  ──────▶  /attend  (public, no login)              │
   (browser GPS)     │     │  POST /api/attendance                │
                     │     ▼                                      │
                     │  Server validates: roster? + Zod +         │
                     │  Haversine geofence + server timestamp     │
                     │     │                                      │
   Duty officer ─────▶  /admin/*  (JWT cookie, RBAC)   ──────────▶│  Prisma ─▶ SQLite
   (login)           │     PATCH /api/admin/*  → writes audit log │  (or Postgres)
                     └──────────────────────────────────────────┘
```

Key decisions:

- **Server is the source of truth.** Timestamps (`presentAt`), geofence pass/fail, and distance are computed on the server in the API route — never trusted from the client. The phone only supplies raw lat/lng/accuracy.
- **Two surfaces, one codebase.** `/attend` is public and can *only* submit attendance. Everything under `/admin` and `/api/admin` is protected by middleware + a JWT session cookie with role-based access.
- **IST-anchored days.** A roll call at 19:00 always belongs to the correct calendar day regardless of server timezone, because all "day keys" are computed in Asia/Kolkata.
- **Editable geofence.** The HQ centre/radius lives in the database (`HqLocation`) and is editable from **Admin → Settings**, seeded from environment variables.

### Why this stack

| Requirement | Choice | Why |
|---|---|---|
| Mobile-first, fast | Next.js App Router + Tailwind | Server components keep the phone payload small; one deploy serves form + dashboard. |
| Relational data + history | Prisma + SQLite (Postgres-ready) | Zero-setup self-hosting at HQ; schema avoids enums/arrays so it ports to Postgres/Supabase by changing one line. |
| Validation | Zod | Same schemas validate the public form and admin edits server-side. |
| Geofence | Browser Geolocation + Haversine | No external API; works offline-capable on the server. |
| Admin auth + RBAC | `jose` JWT (httpOnly cookie) + `bcryptjs` | No native build steps, edge-safe middleware, simple to self-host. |
| Charts / export | Recharts + CSV + print-to-PDF | Lightweight, printable daily report built in. |

> The brief suggested shadcn/ui + Supabase. We hand-rolled clean Tailwind components (no CLI step, so the project builds immediately) and defaulted to SQLite for true zero-setup on-prem hosting. Swapping to Supabase/Postgres is a one-line datasource change (see §K).

---

## B. Database schema

Defined in `prisma/schema.prisma`. Statuses are validated strings (`PENDING | PRESENT | ABSENT | OFF | AVAILABLE | DUTY_ASSIGNED`) rather than Prisma enums, so the schema is portable to SQLite *and* Postgres.

- **User** — admin accounts. `username` (unique), `passwordHash` (bcrypt), `role` (`ADMIN` / `SUPERADMIN`), `active`. Relations: `audits`, `editedRecords`.
- **Pc** — the people. `pcNumber` (= G.No, unique), `rank` (default `PC`), `name?`, `unit?`, `mobile?`, `active`.
- **DailyRoster** — one row per day. `date` (unique `YYYY-MM-DD` IST key), `platoon` (default `NIGHT`), `rollCallTime` (default `19:00`), `vehicleNo?`, `instructions?` (standing order), `locked`.
- **DailyRosterEntry** — a PC's slot on a given day. `rosterId`, `pcId`, `slNo`, `dutyRemarks?`; unique on `(rosterId, pcId)`; 1:1 with attendance.
- **AttendanceRecord** — the mark. `date` (denormalised), `entryId` (unique, 1:1), `pcId`, `status` (default `PENDING`), `markedAt?`, `presentAt?`, `latitude?`, `longitude?`, `accuracyM?`, `distanceM?`, `geofenceOk?`, `dutyLocation?`, `dutyRemarks?`, `source` (default `self`), `editedById?`. Cascade-deletes with its entry.
- **AuditLog** — immutable history. `at`, `actorId?`, `actorLabel`, `action`, `entity`, `entityId?`, `attendanceId?`, `field?`, `oldValue?`, `newValue?`, `meta?` (JSON).
- **HqLocation** — the geofence. `name`, `mapsUrl?`, `latitude`, `longitude`, `radiusM` (default 150), `active`.

Constraints that enforce the business rules: one attendance record per PC per day (unique `entryId`), unique `(rosterId, pcId)` prevents the same PC twice on a roster, unique `pcNumber` and unique roster `date`.

---

## C. Folder / file structure

```
night-rollcall/
├─ prisma/
│  ├─ schema.prisma            # all models
│  └─ seed.ts                  # admin user, HQ row, 29-05-2026 NIGHT roster
├─ src/
│  ├─ middleware.ts            # protects /admin & /api/admin, redirects /login
│  ├─ app/
│  │  ├─ layout.tsx  globals.css  page.tsx      # landing
│  │  ├─ attend/page.tsx       # PUBLIC mobile attendance form
│  │  ├─ login/page.tsx        # admin login
│  │  ├─ admin/
│  │  │  ├─ layout.tsx         # nav + requireAdmin()
│  │  │  ├─ page.tsx           # dashboard (live roll call)
│  │  │  ├─ roster/page.tsx    # import / edit roster
│  │  │  ├─ reports/page.tsx   # charts + duty summary + detail
│  │  │  ├─ audit/page.tsx     # audit trail with filters
│  │  │  └─ settings/page.tsx  # HQ geofence editor
│  │  └─ api/
│  │     ├─ attendance/route.ts            # POST public submit
│  │     ├─ attendance/lookup/route.ts     # GET confirm PC on roster
│  │     ├─ admin/attendance/route.ts      # PATCH edit (audited)
│  │     ├─ admin/roster/import/route.ts   # POST commit roster
│  │     ├─ admin/roster/upload/route.ts   # POST parse Excel/CSV → preview
│  │     ├─ admin/hq/route.ts              # PATCH geofence
│  │     ├─ auth/login/route.ts            # set session cookie
│  │     └─ auth/logout/route.ts
│  ├─ components/   # StatusBadge, SummaryCards, DateNav, AttendanceTable,
│  │                # RosterManager, ReportCharts, ReportActions,
│  │                # AuditFilters, SettingsForm, LogoutButton
│  └─ lib/          # db, config, date(IST), geo(Haversine), validation(Zod),
│                   # auth(JWT), password(bcrypt), audit, hq, queries,
│                   # roster-parse, roster-service, types
├─ .env / .env.example
├─ package.json  tsconfig.json  tailwind.config.ts  next.config.mjs  postcss.config.mjs
```

---

## D / E. Working code & API routes

All files are real, runnable code (no pseudocode). The API surface:

| Method & route | Auth | Purpose |
|---|---|---|
| `GET  /api/attendance/lookup?pc=` | public | Confirm a PC is on today's roster; returns minimal info. |
| `POST /api/attendance` | public | Submit attendance. Server enforces geofence for Present, sets the timestamp, blocks duplicates. |
| `PATCH /api/admin/attendance` | admin | Edit status / duty location / remarks; writes a per-field audit entry. |
| `POST /api/admin/roster/upload` | admin | Parse an uploaded `.xlsx/.csv` into a preview (no DB write). |
| `POST /api/admin/roster/import` | admin | Commit a roster + create PENDING attendance rows. |
| `PATCH /api/admin/hq` | admin | Update HQ centre/radius (audited). |
| `POST /api/auth/login` · `POST /api/auth/logout` | — | Session cookie management. |

---

## F. Geofence logic (`src/lib/geo.ts`)

`haversineMeters(a, b)` returns great-circle distance in metres. `validateGeofence({ lat, lng, accuracyM }, hq)`:

1. Compute distance from the submitted point to the HQ centre.
2. Allow a small accuracy buffer (the smaller of the device's reported accuracy or 50 m) so a true-positive standing at the gate isn't rejected by GPS jitter.
3. Pass if `distance ≤ radius + buffer`. Otherwise the submission is rejected with the exact required message: **"Attendance not allowed outside HQ location."**

The check runs on the **server** inside `POST /api/attendance`, using the HQ row from the database. `distanceM` and `geofenceOk` are stored on the record for audit.

---

## G. Attendance save logic (`POST /api/attendance`)

1. Zod-validate the body (`pcNumber`, `status`, optional `latitude/longitude/accuracy`, `remarks`).
2. Look up today's roster entry for that PC (IST day). If absent → 404 "not on today's roster".
3. **Present** requires lat/lng → run the geofence. If outside → write a `BLOCKED_OUT_OF_ZONE` audit entry and return 403 with the standard message.
4. **Present** is set with a **server timestamp** (`presentAt = now`), lat/lng/accuracy/distance/`geofenceOk` stored. Absent/Off/Available record the status + `markedAt` only (no GPS needed).
5. **Duplicate guard:** a PC already Present today cannot silently overwrite — re-submission is rejected so the original timestamp stands (admins can still correct via the dashboard).
6. Every self-submission writes a `MARK_PRESENT` / `MARK_STATUS` audit entry with `source: "self"`.

---

## H. Admin edit flow (`PATCH /api/admin/attendance`)

The dashboard table (`AttendanceTable`) edits **auto-save**: changing the status `<select>` PATCHes immediately; duty location / remarks save on blur. The UI updates optimistically and reverts on error. Server-side, each changed field is diffed against the current value and written as its own audit row (`ADMIN_UPDATE_STATUS`, `ADMIN_EDIT_REMARKS`, `ADMIN_EDIT_DUTY_LOCATION`) with `oldValue → newValue` and the acting admin. Admin edits never require a geofence (corrections happen at a desk).

---

## I. Audit trail logic (`src/lib/audit.ts`)

`writeAudit()` appends an immutable `AuditLog` row and accepts a transaction client so roster imports and attendance writes are atomic with their audit entry. Captured: who (`actorLabel`, e.g. `admin:ravi` or `self:PC11809`), what (`action`), which record (`entity`/`entityId`/`attendanceId`), and the change (`field`, `oldValue`, `newValue`, or `meta` JSON). **Admin → Audit** lists the latest 300 entries with entity / action / date filters.

---

## J. Roster import logic (`src/lib/roster-parse.ts` + `roster-service.ts`)

- **Parsing** auto-detects the header row (the duty passport has title rows above it), normalises column names (`G.No`, `PC Number`, `Coy/Unit`, `Mobile No.`, `Remarks`…), cleans Excel float artifacts (`11809.0 → 11809`), and **skips `#ERROR!`/blank-PC rows** — exactly the state of the uploaded sheet.
- **Admin → Roster** lets you upload `.xlsx/.csv`, *or* paste comma/tab rows, *or* add PCs manually, edit everything inline, then **Commit**.
- `applyRoster()` runs in a transaction: upsert each `Pc`, upsert the `DailyRoster`, create entries + one PENDING `AttendanceRecord` each, and write an `IMPORT_ROSTER` / `RESET_ROSTER` audit entry. "Replace" clears the day's entries first; otherwise new PCs are appended. **Resetting the next day's roster** is just picking tomorrow's date and committing.

---

## K. Setup & deployment

### Local

```bash
npm install
cp .env.example .env            # then edit AUTH_SECRET + HQ coordinates
npm run setup                   # prisma generate + db push + seed
npm run dev                     # http://localhost:3000
```

`npm run setup` creates `dev.db`, the admin user, the HQ geofence row, and the sample 29-05-2026 roster.

### Deploy

- **Self-host (recommended for SQLite):** a small VPS with Node 18+. `npm run build && npm run start` behind nginx. Keep `dev.db` on a persistent volume and back it up.
- **Vercel / serverless:** SQLite files are not persistent there — switch to Postgres/Supabase first: set `provider = "postgresql"` in `schema.prisma`, point `DATABASE_URL` at the managed DB, run `npm run db:push && npm run db:seed`, then deploy. No model changes needed (no enums/arrays were used).
- **HTTPS is required** — browsers only grant geolocation on secure origins (or `localhost`).

---

## L. Environment variables

See `.env.example`. Summary:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) or a Postgres URL. |
| `AUTH_SECRET` | **Required.** ≥32-char random string for JWT signing. |
| `ADMIN_USERNAME` / `ADMIN_DEFAULT_PASSWORD` | Seed admin credentials (default `admin` / `ChangeMe@123`). |
| `HQ_NAME`, `HQ_MAPS_URL` | HQ label + reference link. |
| `HQ_LAT`, `HQ_LNG`, `HQ_RADIUS_M` | Seed geofence centre + radius (m). |
| `ROLL_CALL_TIME` | Default `19:00`. |

---

## M. Seed data (`prisma/seed.ts`)

Seeds: the admin user (`SUPERADMIN`), the HQ geofence row from env, and the **29-05-2026 NIGHT roster** parsed from the uploaded sheet — the 10 real G.No entries `11809, 10349, 13359, 11899, 13647, 11042, 11847, 13349, 12327, 4828` (`4828 / RAMESH / CIVIL / 7075107981` is fully populated; the rest have PC numbers with name/unit left for the duty officer to fill), plus the standing-order instruction text. The broken `#ERROR!` rows and empty slots from the sheet are skipped.

---

## N. Running locally & deploying — final note

```bash
npm install && cp .env.example .env && npm run setup && npm run dev
```

Open **http://localhost:3000**. Log in at `/admin` with `admin / ChangeMe@123` (change it immediately). Share **`/attend`** with PCs for mobile self-marking.

### ⚠️ Two things to do before real use

1. **Set the real HQ coordinates.** The seeded centre is a Hyderabad placeholder — the Google Maps short link could not be resolved during the offline build. Open your official location link, read the exact latitude/longitude, and set them in **Admin → Settings** (or `HQ_LAT`/`HQ_LNG`). You can also stand at the roll-call point and tap "Use my current location" on that page. Until this is correct, the geofence may wrongly allow or block attendance.
2. **Change the admin password and `AUTH_SECRET`** before exposing the app.

> Build note: this project was assembled in an offline environment, so dependencies were not installed and `next build` was not executed here. Run `npm install` then `npm run build` on your machine to produce the verified production build.
