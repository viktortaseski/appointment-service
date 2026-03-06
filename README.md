# Appointment Service

Multi-tenant dental appointment platform built with Next.js (App Router) and PostgreSQL.

The project supports:
- Public clinic booking flows
- Clinic admin dashboard (`/admin`)
- Optional super admin panel (`/admin/super`)
- Appointment reminders, cancellation, and rescheduling
- Multi-clinic routing by domain

## Tech Stack

- Next.js 14 (App Router)
- React 18
- PostgreSQL (`pg`)
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Cloudinary uploads (optional)
- Brevo email API (optional, used for confirmations/reminders)

## Repository Layout

This repository currently contains one app under `frontend/`.

```text
frontend/
  src/
    app/                # Pages and API route handlers
    features/           # Feature-first UI modules (booking, admin)
    shared/             # Shared components and i18n provider
    lib/server/         # Server-side business logic and integrations
  scripts/              # DB migrations and password migration scripts
```

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm 9+
- PostgreSQL 14+

## Quick Start (Local)

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Create local env file:

```bash
cp .env.example .env
```

3. Add required variables in `frontend/.env`:
- `DATABASE_URL_DEV` (or `DATABASE_URL`)
- `JWT_SECRET`

4. Run database migrations:

```bash
npm run migrate
```

5. Start dev server:

```bash
npm run dev
```

6. Open:
- Booking app: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`
- Super admin (if enabled): `http://localhost:3000/admin/super`

## Available Scripts

From `frontend/`:

- `npm run dev`: start local dev server
- `npm run build`: production build
- `npm run start`: run production server
- `npm run lint`: run Next.js lint
- `npm run migrate`: apply schema and seed local demo clinic records
- `npm run hash-passwords`: migrate legacy plaintext doctor passwords to `password_hash`

## Environment Variables

`frontend/.env.example` includes reminder-related values. Additional variables are used by the app.

### Core

- `DATABASE_URL` (production DB connection)
- `DATABASE_URL_DEV` (dev DB connection)
- `JWT_SECRET` (required for clinic admin auth)
- `NEXT_PUBLIC_API_URL` (defaults to `/api`)
- `NEXT_PUBLIC_CLINIC_DOMAIN` (optional override for clinic resolution)

### Super Admin (optional)

- `SUPER_ADMIN_ENABLED=true`
- `SUPER_ADMIN_USERNAME`
- `SUPER_ADMIN_PASSWORD_HASH` (preferred) or `SUPER_ADMIN_PASSWORD` / `SUPER_ADMIN_PW`
- `SUPER_ADMIN_JWT_SECRET` (falls back to `JWT_SECRET`)

### Email + Reminder Jobs (optional but recommended)

- `CRON_SECRET`
- `BREVO_API_KEY`
- `BREVO_APPOINTMENT_TEMPLATE_ID`
- `BREVO_APPOINTMENT_REMINDER_TEMPLATE_ID`
- `BREVO_APPOINTMENT_RESCHEDULE_TEMPLATE_ID`
- `BREVO_APPOINTMENT_CANCEL_TEMPLATE_ID`
- `APPOINTMENT_REMINDER_OFFSET_MINUTES` (default `125`)
- `APPOINTMENT_TIMEZONE` (default `Europe/Skopje`)

### Cloudinary Uploads (optional)

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Runtime/Debug

- `NODE_ENV`
- `DATABASE_SSL` / `PGSSLMODE=require` (for SSL DB connections)
- `DEBUG_LOGS=true` (enables verbose internal debug logging)
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` (used for reminder link generation fallback)

## Reminder Job

The repository contains `.github/workflows/reminders.yml` that triggers every 15 minutes.

It calls a protected endpoint with bearer auth:
- `POST /api/reminders/run`

Required GitHub Secrets:
- `REMINDER_CRON_SECRET`
- `REMINDER_ENDPOINT_URL`

`REMINDER_CRON_SECRET` must match the app's `CRON_SECRET`.

## API Surface (High-Level)

Route handlers live under `frontend/src/app/api/`, including:
- `appointments` (create/list/update/cancel/reschedule/reminders)
- `availability`
- `clinic` and `clinics`
- `doctors`
- `patients`
- `ratings`
- `auth` and `super/*`
- `uploads/*`

## Security Notes

- `.env` files are git-ignored; only `.env.example` should be committed.
- Avoid committing real keys or credentials to source control.
- Prefer hashed credentials (`SUPER_ADMIN_PASSWORD_HASH`) over plaintext passwords.
- Review CI/CD secrets before publishing.

## License

This project is licensed under the GNU Affero General Public License v3.0.

See [LICENSE](./LICENSE).
