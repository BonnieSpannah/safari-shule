# Install — macOS

Everything you need before running Safari Shule for the first time.

## Prerequisites

| Tool           | Version     | Install                                                                                 |
| -------------- | ----------- | --------------------------------------------------------------------------------------- |
| Homebrew       | latest      | `curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh \| bash` |
| Git            | 2.40+       | `brew install git`                                                                      |
| Node.js        | **20.11.0** | `brew install nvm && nvm install` (auto-reads `.nvmrc`)                                 |
| pnpm           | 9.x         | `corepack enable && corepack prepare pnpm@latest --activate`                            |
| Docker Desktop | 4.30+       | <https://docker.com/products/docker-desktop> or Orbstack                                |

Verify everything is wired before continuing:

```bash
make preflight
```

A passing run prints every check in green. Fix anything red before continuing.

## Clone and install

```bash
git clone git@github.com:BonnieSpannah/safari-shule.git
cd safari-shule
pnpm install
```

## Configure environment

```bash
cp .env.example .env
```

The defaults work for local development without edits. Change these if you need non-defaults:

| Key                    | Default                  | When to change                             |
| ---------------------- | ------------------------ | ------------------------------------------ |
| `SUPER_ADMIN_EMAIL`    | `admin@safarishule.test` | If you want a different login email        |
| `SUPER_ADMIN_PASSWORD` | `ChangeMe!Now1`          | Always change before sharing the install   |
| `APP_BASE_DOMAIN`      | `safarishule.test`       | Only if you're using a custom local domain |

The full variable reference — including JWT secrets, Redis, M-Pesa, and Africa's Talking config — is in `.env.example` with inline comments.

### Web-only overrides (optional)

If you need to point the browser at a different API URL, copy the web env template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Leave it empty (or don't create it) to use the defaults (`http://localhost:3000` for the API, `http://localhost:5173` for the web app).

## Optional: Laravel Herd + TLS

For `*.safari-shule.test` with real TLS locally (mirrors production certificate posture):

```bash
brew install laravel/tap/herd mkcert
make bootstrap
```

See [herd-setup.md](herd-setup.md) for full details.

## Next step

→ [first-run.md](first-run.md) — boot the stack, migrate, seed, and log in.
