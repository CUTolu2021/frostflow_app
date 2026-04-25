# Contributing

## Branching Model

- Base branch: `main`
- Create a branch per change:
  - `feature/<short-name>`
  - `fix/<short-name>`
  - `chore/<short-name>`

Examples:

- `feature/staff-invite-mail`
- `fix/reconciliation-escalation-status`

## Local Quality Checks

Run before opening a PR:

```bash
npm run build
node -e "require('./backend/src/app'); console.log('backend ok')"
```

Optional:

```bash
npm test
```

## Pull Request Checklist

- Clear title and summary of user-facing impact
- Linked issue/task (if available)
- Screenshots for UI changes
- Migration notes for SQL changes
- Backward-compatibility notes for API changes
- No secrets or local `.env` files committed

## Commit Style (recommended)

Use short, concrete commits:

- `feat: add manual reconciliation trigger endpoint`
- `fix: prevent invite email failure from blocking invite creation`
- `docs: refresh README setup and security notes`

## Review Expectations

- Prioritize correctness, security, and regression risk
- Include test evidence in PR description
- Keep PR scope focused; prefer small PRs over large mixed changes
