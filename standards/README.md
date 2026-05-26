# standards

Shared engineering standards and Claude skills. Used as a git submodule in all projects.

## Usage

Add to a project:

```bash
git submodule add git@github.com:org/standards.git standards
git submodule update --init
```

Then in the project's `CLAUDE.md`:

```markdown
@import ./standards/CLAUDE.md

## Project-specific context
...
```

For slash commands to work in the project, symlink or copy the skill files:

```bash
mkdir -p .claude/skills
for skill in standards/skills/*/; do
  name=$(basename "$skill")
  ln -s "../../$skill" ".claude/skills/$name"
done
```

Update to the latest standards:

```bash
git submodule update --remote standards
git add standards
git commit -m "chore: update standards submodule"
```

## Contents

```
standards/          Architectural rules and coding conventions
  ARCHITECTURE.md   Layer boundaries, service design, data flow, SVX patterns
  CODING_STANDARDS.md  Naming, functions, comments, git

skills/             Claude skill files for focused tasks
  api-design/       REST conventions and NestJS controller rules
  new-service/      How to scaffold a new DeclareService/Implementation service
```

## Contributing

Changes to standards affect all projects. For significant changes:

1. Open a PR with the proposed change and your reasoning.
2. If it reverses or contradicts an existing rule, note the reason in the PR.
3. Notify teams so they can update their pinned submodule ref when ready.

Typos and clarifications can be merged without ceremony.
