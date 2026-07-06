# FrostFlow Inventory SaaS

FrostFlow is a multi-tenant inventory, sales, and reconciliation system for retail and cold-room operations.
Its core goal is simple: reduce shrinkage, improve accountability, and give operators a clean way to track stock, sales, expenses, and mismatches across organizations.

## Features

- Multi-tenant organizations with role-based users: `superadmin`, `admin`, `manager`, `sales`
- In-house authentication with JWT access tokens and refresh sessions
- Superadmin organization provisioning and owner bootstrap flow
- Staff invite flow with expiring signup links
- Forced password reset on first login or admin reset
- Route-level rate limiting on login, invite creation, and password reset endpoints
- Product catalog with organization-scoped categories
- Stock-in and staff-receive capture
- `dual_control` and `single_operator` inventory modes per organization
- Reconciliation engine with manual "Run Check Now" support
- Delivery-session based stock matching between owner and staff intake
- Mixed-payment sales: `cash`, `transfer`, `card`, `credit`, `mixed`
- Decimal-safe quantities and prices for stock and sales
- Manual miscellaneous expenses with backdated entry support
- Analytics screens for overview, sales history, expenses, and AI insights
- Audit logs for important write actions

## Tech Stack

- Frontend: Angular 19
- Backend: Node.js + Express
- Database: Supabase Postgres using the `frostflow_data` schema
- Security: JWT, refresh token rotation, role checks, rate limiting, RLS-aware schema design

## Local Setup

### 1. Prerequisites

- Node.js LTS recommended: `20.x` or `22.x`
- npm
- Supabase project with `frostflow_data` schema

### 2. Install

```bash
npm install
```

### 3. Backend environment

Create `backend/.env` from `backend/.env.example` and fill in real values.

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
RECONCILIATION_DEFAULT_GRACE_HOURS=24
RECONCILIATION_AUTO_ACCEPT_TOLERANCE_KG=0.5
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
11. `backend/sql/011_delivery_sessions.sql`
12. `backend/sql/012_inventory_mode.sql`
13. `backend/sql/013_decimal_precision.sql`
14. `backend/sql/014_mixed_sale_payments.sql`
15. `backend/sql/015_misc_expenses.sql`

## Run

```bash
npm run dev
```

Or split frontend and backend:

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
- App:
  - `GET /api/app/metrics/dashboard`
  - `GET /api/app/sales/history`
  - `GET /api/app/expenses`
  - `POST /api/app/expenses`
- Admin:
  - `GET /api/admin/organizations`
  - `POST /api/admin/organizations`
  - `GET /api/admin/users`

## Analytics Notes

- `Inventory Value` currently represents estimated sale value on hand:
  - `current stock units * product.unit_price`
- `Overview` is intentionally snapshot-style:
  - it does not follow the History or Expenses tab filters
  - it refreshes when the page reloads, the user re-enters the page, or the user clicks `Sync metrics`
- `History` and `Expenses` each maintain their own filter state
- Expense analytics includes:
  - stock purchase costs
  - logistics costs
  - miscellaneous manually entered expenses

## Security Notes

- Never commit real secrets like `backend/.env`, private keys, or production tokens
- `backend/.env` and root `.env` are ignored by git
- If anything sensitive is exposed, rotate it immediately
- Current rate limiting uses the in-memory store from `express-rate-limit`
  - good for a single backend instance
  - move to Redis if you later run multiple API instances

## Contribution Workflow

Use feature branches and pull requests.
See [CONTRIBUTING.md](CONTRIBUTING.md) for naming, PR checklist, and review expectations.
