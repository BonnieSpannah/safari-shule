# Contributing — Safari Shule

## Branch model — GitLab Flow

- `main` — trunk, always green, auto-deploys to `dev` env.
- `staging` — fast-forward-only from `main`, deploys to UAT.
- `production` — fast-forward-only from `staging`, tags SemVer, deploys prod.
- Feature branches: `feature/<TICKET>-<kebab>`, `fix/<TICKET>-<kebab>`, `chore/<kebab>`, `hotfix/<TICKET>-<kebab>`.
- Hotfix cuts from `production` and back-merges to `staging` + `main`.

## Commit format — Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`.
Breaking change: append `!` to type (`feat(api)!: rename /v1/foo to /v1/bar`).

Examples:

```
feat(api): add SOS incident endpoint
fix(web): prevent double-submit on invitation accept
test(api): cover hardware HMAC replay rejection
docs(runbook): add tenant onboarding steps
```

## PR checklist

- [ ] Types compile (`tsc --noEmit`)
- [ ] Lint clean (`eslint --max-warnings 0`)
- [ ] Tests pass, coverage gates met (see [TESTING.md](TESTING.md))
- [ ] Every modified `src/**/*.ts` has a matching modified `*.spec.ts` / `*.test.tsx` / `*.e2e-spec.ts` — or a `[no-test]` commit trailer justifies the exception
- [ ] `test:` commit precedes the first `feat:` / `fix:` commit on the branch
- [ ] Docs updated for any API contract or setup change
- [ ] Prisma migration included if `schema.prisma` changed
- [ ] No `// TODO`, no stub handlers, no example placeholders
- [ ] No comments explaining what the code does — only why (if non-obvious)

## PR title = squash commit message

Because we squash-merge into `main`, the PR title becomes the commit. Follow the Conventional Commits format there too.

## Code style

- **TypeScript strict** — no `any` unless justified with a comment.
- **No comments unless the *why* is non-obvious** — no file-header docstrings.
- **Small files** — extract when a file exceeds ~300 lines.
- **Colocate tests** — `foo.service.ts` + `foo.service.spec.ts` in the same folder.
- **Import order** — third-party → workspace (`@safari-shule/*`) → relative. Prettier + eslint-plugin-import enforce.

## Reviewing

- **Two approvals** required on paths in [CODEOWNERS](../.github/CODEOWNERS) *(M6)*: `apps/api/src/auth/**`, `apps/api/src/modules/payments/**`, `apps/api/src/modules/hardware/**`, `apps/api/prisma/**`.
- **One approval** for everything else.
- Reviewers block on: missing tests, broken CI, undocumented breaking changes, security regressions.

## Getting help

- Product / architecture questions → [.copilot/SESSION-HANDOFF.md](../.copilot/SESSION-HANDOFF.md) + [ARCHITECTURE.md](ARCHITECTURE.md)
- Hard rules → [.github/copilot-instructions.md](../.github/copilot-instructions.md)
- Domain quirks → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
