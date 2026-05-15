# Project Overview

SVX is a NestJS-based monorepo using Nx. It serves as the backend platform for [describe your product].

# Architecture

- `libs/service/nestjs/` — shared NestJS service utilities and REST proxies
- `libs/user/core/` — user domain logic and REST proxies
- Apps live under `apps/`

# Common Commands

## Development
npm run dev           # start dev server
nx serve <app-name>   # serve a specific app

## Testing
nx test <project>     # run tests for a project
nx run-many -t test   # run all tests

## Linting
nx lint <project>

## Build
nx build <project>

# Code Style

- TypeScript strict mode enabled
- No comments unless the WHY is non-obvious
- No mocks in tests — use real integrations

# Key Conventions

- REST proxy configs live in `rest-proxies.json` files alongside their library
- Environment-specific config is managed via deployment manager

# Do Not

- Do not add error handling for impossible scenarios
- Do not add backwards-compatibility shims for removed code
- Do not commit `.env` files
