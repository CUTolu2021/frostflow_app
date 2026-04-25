# FrostFlow Inventory SaaS

FrostFlow is a multi-tenant inventory and reconciliation system for retail operations.  
Primary objective: reduce shrinkage by requiring double-entry stock records and surfacing mismatches quickly.

## Features

- Multi-tenant organizations (`organizations`) with role-based users (`superadmin`, `admin`, `manager`, `sales`)
- In-house authentication (JWT access + refresh sessions), no third-party auth dependency
- Superadmin organization provisioning with owner bootstrap flow
- Staff invite flow with expiring signup links
- Forced password reset on first login / admin reset
- Stock-in and staff-receive capture
- Reconciliation engine using:
  - `product_id`
  - daily/session window (`window_date`)
  - cutoff escalation (`is_escalated`, `escalated_at`)
- Manual “Run Check Now” reconciliation trigger for immediate verification
- Audit log trails and role-protected write endpoints

## Tech Stack

- Frontend: Angular 19
- Backend: Node.js + Express
- Database: Supabase Postgres (`frostflow_data` schema)
- Security: JWT, refresh token rotation, route-level authorization, rate limiting

## Local Setup

### 1. Prerequisites

- Node.js LTS recommended (20.x or 22.x)
- npm
- Supabase project with `frostflow_data` schema

### 2. Install

```bash
npm install
```

### 3. Backend environment

Create `backend/.env` from `backend/.env.example` and fill real values.

```env
API_PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=14
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_SCHEMA=frostflow_data
CORS_ORIGIN=http://localhost:4200,http://127.0.0.1:4200
BOOTSTRAP_ADMIN_TOKEN=one-time-bootstrap-token
ALLOW_DUMMY_PASSWORD_LOGIN=true
FRONTEND_URL=http://localhost:4200
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-google-app-password
SMTP_FROM="Frostflow <your-email@gmail.com>"
RECONCILIATION_CUTOFF_HOUR_UTC=20
```

### 4. Frontend environment

`src/environments` is intentionally gitignored. Create:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Minimum expected shape:

```ts
export const environment = {
  api_url: 'http://localhost:3001',
  supabase_URL: '',
  supabase_anon_key: '',
  n8n_webhook: '',
  production: false,
};
```

## Database Migrations

Run in order:

1. `backend/sql/001_auth_password_hash.sql`
2. `backend/sql/002_auth_sessions.sql`
3. `backend/sql/003_multitenant_rls.sql`
4. `backend/sql/004_reset_and_seed.sql`
5. `backend/sql/005_superadmin_features.sql`
6. `backend/sql/006_fix_users_id_default.sql`
7. `backend/sql/007_soft_delete_organizations.sql`
8. `backend/sql/008_staff_invites.sql`
9. `backend/sql/009_staff_invites_hardening.sql`
10. `backend/sql/010_reconciliation_engine.sql`

## Run

```bash
npm run dev
```

Or split:

```bash
npm run start
npm run start:api
```

- Frontend: `http://localhost:4200`
- API: `http://localhost:3001`

## Useful Scripts

- `npm run bootstrap:password`
- `npm run seed:dummy-users`
- `npm run build`

## API Highlights

- Auth:
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/change-password`
  - `POST /api/auth/staff/invite`
  - `GET /api/auth/staff/invite/preview`
  - `POST /api/auth/staff/invite/complete`
- Inventory/Reconciliation:
  - `POST /api/inventory/stock-in`
  - `POST /api/inventory/staff-stock-in`
  - `POST /api/inventory/reconciliation/resolve`
  - `POST /api/inventory/reconciliation/run`
- Admin:
  - `GET /api/admin/organizations`
  - `POST /api/admin/organizations`
  - `GET /api/admin/users`

## Security Notes

- Never commit real secrets (`backend/.env`, private keys, production tokens).
- `backend/.env` and root `.env` are ignored by git.
- If anything sensitive is exposed, rotate it immediately.

## Contribution Workflow

Use feature branches + pull requests.  
See [CONTRIBUTING.md](CONTRIBUTING.md) for naming, PR checklist, and review expectations.
