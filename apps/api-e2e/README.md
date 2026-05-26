# api-e2e

Integration tests for `apps/api`. Hits real Keycloak (`localhost:8080`) and Postgres (`localhost:5433`) — no mocks.

## Run

The `nx e2e api-e2e` target is currently blocked by an unrelated nx project-graph validation issue elsewhere in the repo, so run vitest directly:

```bash
cd apps/api-e2e
OIDC_AUTHORITY=http://localhost:8080/realms/service npx vitest run
```

## Prerequisites

- Keycloak container up: `docker compose -f docker/docker-compose.yml up -d keycloak`
- Postgres container up: `docker compose -f docker/docker-compose.yml up -d db`
- Realm `service` exists with client `service-browser` and user `admin/admin`

## Coverage

- `auth.e2e.spec.ts` — boots the full `ApplicationModule`, fetches a real Keycloak token, asserts:
  - unauthenticated → 401
  - valid Bearer → 200 with users payload
  - garbage Bearer → 401
