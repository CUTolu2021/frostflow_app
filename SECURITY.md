# Security Policy

## Secrets Handling

Do not commit:

- `backend/.env`
- root `.env`
- private keys
- production API tokens

Safe files to commit:

- `backend/.env.example`
- SQL migrations without credentials

## If a Secret Is Exposed

1. Rotate the exposed key/token immediately.
2. Invalidate any active sessions if applicable.
3. Replace leaked credentials in all environments.
4. Remove leaked values from code and history if needed.

## Recommended Pre-Push Checks

```bash
git status --short --ignored
git check-ignore -v backend/.env .env
```

Optional text scan:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**' "JWT_SECRET|SUPABASE_SERVICE_ROLE_KEY|SMTP_PASS|BOOTSTRAP_ADMIN_TOKEN|PRIVATE KEY|AKIA|ghp_|AIza|sk-"
```
