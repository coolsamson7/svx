# Docker

## Start

```bash
docker compose -f docker-compose.yml up -d
```

Starts:
- PostgreSQL on port `5432` (user: `postgres`, password: `postgres`)
- Keycloak on port `8080` with the `service` realm pre-imported

## Keycloak

Admin console: http://localhost:8080/admin/master/console/
- Username: `admin`
- Password: `admin`

## PostgreSQL

Connects automatically to the API via the default env vars:
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DB_NAME=postgres`
