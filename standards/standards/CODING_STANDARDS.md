# Coding standards

## Naming

- Names describe what a thing *is* or *does*, not how it is implemented.
  `UserRepository` not `UserPostgresAdapter`. `sendWelcomeEmail` not `callSendgrid`.
- Booleans are prefixed: `isActive`, `hasPermission`, `canEdit`.
- Functions that return a value are named for what they return: `getUser`, `buildPayload`.
  Functions with side effects are named for what they do: `saveUser`, `publishEvent`.
- Avoid abbreviations except universally understood ones (`id`, `url`, `http`).

## Functions and methods

- One level of abstraction per function. If a function both orchestrates steps *and*
  implements one of them, split it.
- Maximum ~20 lines of logic per function. More is a sign it should be decomposed.
- Prefer pure functions. Side effects are explicit in the name and isolated to the
  infrastructure layer.
- No boolean parameters that change a function's behaviour. Use two functions or an enum.

## Comments

- Comments explain *why*, not *what*. If the what needs explaining, rename things.
- Every public interface (function, class, module) has a doc comment.
- TODO comments include a ticket reference: `// TODO(PROJ-123): remove after migration`.

## Error handling

- Never silently swallow errors. Log or return, never both (avoids double-logging).
- Error messages are written for the person who will read them in a log at 2am:
  include what failed, what was being attempted, and any relevant IDs.
- Do not use errors for flow control. Errors mean something unexpected happened.

## Tests

See `skills/testing/SKILL.md` for testing conventions.

- Every public function has at least one test.
- Tests are named: `[unit under test] [scenario] [expected outcome]`.
  Example: `createUser with duplicate email returns conflict error`.
- Test files live next to the code they test, not in a separate top-level folder.

## Git

- Commits are atomic: one logical change per commit.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, etc.
- No commented-out code in commits. Delete it; git history preserves it.
- Branch names: `type/short-description` — e.g. `feat/user-invite`, `fix/token-expiry`.
