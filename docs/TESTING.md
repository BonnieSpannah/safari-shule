# Testing — Safari Shule

TDD is enforced, not suggested. Loop: **red → green → refactor**.

## Test pyramid

| Layer | Where | Framework | Target share |
|---|---|---|---|
| Unit | `apps/api/src/**/*.spec.ts`, `apps/web/src/**/*.test.tsx` | Jest (API), Vitest (web) | ~60% |
| Integration | `apps/api/src/**/*.int-spec.ts` | Jest + real Postgres | ~25% |
| E2E | `apps/api/test/*.e2e-spec.ts`, `apps/web/e2e/*.spec.ts` *(M5)* | Jest+supertest (API), Playwright (web) | ~15% |

## Coverage gates

Enforced in CI:

- Global patch coverage ≥ **80%** on touched lines.
- ≥ **95%** in `auth/`, `payments/`, `hardware/`.
- Weekly Stryker mutation testing on those three modules; threshold **70%**.

## Enforcement

Three layers (M6 will wire these end-to-end):

1. **Husky pre-commit** — every modified `apps/*/src/**/*.ts` needs a matching modified `*.spec.ts` / `*.test.tsx` / `*.e2e-spec.ts` in the same commit. Bypass with `[no-test]` commit trailer for docs/config only.
2. **Husky pre-push** — `jest --findRelatedTests --bail` + `vitest related --run` on staged files.
3. **CI** — coverage thresholds above.

Commit ordering rule (CI-checked): every feature branch contains a `test:` commit before its first `feat:` / `fix:`.

## Running tests

### API

```bash
pnpm --filter @safari-shule/api run test              # all unit + integration
pnpm --filter @safari-shule/api run test:e2e          # e2e (needs make up + make migrate)
pnpm --filter @safari-shule/api exec jest -t "SOS"    # filter by name
pnpm --filter @safari-shule/api run test -- --coverage
```

### Web

```bash
pnpm --filter @safari-shule/web run test              # vitest --run
pnpm --filter @safari-shule/web run test:watch        # vitest --watch
pnpm --filter @safari-shule/web run test:ui           # vitest --ui
pnpm --filter @safari-shule/web run test:coverage
```

## Existing e2e suites (API)

Located in `apps/api/test/`:

| File | What it locks in |
|---|---|
| `cross-tenant-isolation.e2e-spec.ts` | Tenant A cannot read/write Tenant B's data via any path |
| `permissions.e2e-spec.ts` | RBAC blocks forbidden actions with 403 |
| `feature-gating.e2e-spec.ts` | Plan-tier features + quotas enforced |
| `hardware-hmac.e2e-spec.ts` | HMAC validity, timestamp skew, replay rejection |
| `sos.e2e-spec.ts` | SOS persist + broadcast + SMS legs |

Test helpers in `apps/api/test/helpers.ts`:

- `bootstrapTestApp()` — spins up a Nest app instance
- `seedTenantWithRoles({ withDevice? })` — provisions a fresh isolated tenant
- `buildHardwareHeaders(deviceId, apiKey, hmacSecret, body)` — signs a request
- `cleanupTenant(tenantId)` — hard-delete for teardown

## Writing a test — API example

```ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { VehiclesService } from './vehicles.service';
import { seedTenantWithRoles, cleanupTenant } from '../../../test/helpers';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let tenantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    service = moduleRef.get(VehiclesService);
    ({ tenantId } = await seedTenantWithRoles());
  });

  afterAll(async () => cleanupTenant(tenantId));

  it('creates a vehicle scoped to the caller tenant', async () => {
    const vehicle = await service.create({ plate: 'KDA 001A', capacity: 42, ownership: 'school' });
    expect(vehicle.tenantId).toBe(tenantId);
  });
});
```

## Writing a test — web example

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const renderPage = () => {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

it('validates required fields', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
});
```

## Mocking external services

- `INTEGRATIONS_MODE=mock` in `.env` short-circuits Africa's Talking and M-Pesa in all environments except `production`.
- For web tests, mock the axios client with `vi.mock('@/lib/api/client')`.
- For API tests, override providers with `Test.createTestingModule({ providers: [{ provide: AtService, useValue: mockAt }] })`.

**Never** hit live third-party endpoints from a test. CI blocks outbound network to those domains.

## What "done" means

A feature is done when:

- ✅ Types compile clean (`tsc --noEmit`)
- ✅ Lint passes (`eslint --max-warnings 0`)
- ✅ All existing tests still pass
- ✅ New tests cover the happy path, one edge case, and one failure mode
- ✅ Coverage gates met
- ✅ Docs updated if the API contract or setup steps changed
