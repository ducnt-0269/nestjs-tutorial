# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Medium clone backend API following the RealWorld specification. Delivered as ten pull requests,
one per milestone issue; `gh issue list` shows which are done.

## Commands

```bash
nvm use                      # Node 24, per .nvmrc
docker compose up -d         # PostgreSQL + Redis
npm run start:dev
npm test                     # unit (Vitest)
npm run lint                 # oxlint
npm run typecheck            # only step that type-checks *.spec.ts; nest build skips them
npm run format:check         # Prettier — CI gate
npm run lint:sun             # Sunlint — must report 0 errors before any PR
npm run db:generate          # regenerate Prisma Client after a schema change
```

On a fresh checkout run `npm run db:generate` first: typecheck and oxlint's type-aware rules
both need the generated client.

## ESM

`package.json` sets `"type": "module"`; tsconfig uses `module: nodenext`. **Every relative
import must end in `.js`**, including imports of `.ts` files:

```ts
import { AppModule } from './app.module.js';   // correct
import { AppModule } from './app.module';      // fails at runtime
```

Use `import.meta.dirname`, not `__dirname`.

## Toolchain

`nest new` scaffolds **NestJS 12 + TypeScript 6 + oxlint + Vitest**. Not Jest, not ESLint —
there is no `eslint.config.js`. A unit test exercising decorators needs
`import 'reflect-metadata';` at the top; Nest loads it itself at runtime.

Validation is **Zod 4** (`z.email()`, `z.url({ protocol })`, `error:` callbacks). Zod 3 syntax
fails typecheck. `class-validator` is installed but unused; leave it.

Sunlint reads a comment containing a file name or a backticked identifier as commented-out
code. Write comments in plain prose: "the bootstrap", not `main.ts`.

## Prisma 7

- Config lives in `prisma7.config.ts`; `schema.prisma` carries no `url`, and Prisma no longer
  loads `.env` on its own
- A driver adapter is mandatory — see `PrismaService`
- The client generates into `src/generated/prisma` (gitignored). Never edit it; change the
  schema and run `npm run db:generate`
- `importFileExtension = "js"` in the generator is required by ESM
- `$connect()` is lazy: the app starts even when PostgreSQL is down
- prisma.io/docs serves the newest major, which may be ahead of this project. Check `--help`
  locally instead of copying from the site
- There is no down migration, and no npm script wraps a revert. Generate the down script
  **before** applying the migration — once `migrate dev` runs, the old state is gone from
  both sides of the diff:

```bash
# 1. schema.prisma already edited, migration NOT yet created
npx prisma migrate diff --from-schema prisma/schema.prisma \
                        --to-migrations prisma/migrations \
                        --script > down.sql
# 2. now create and apply it
npm run db:migrate:add
# 3. to revert later
npx prisma db execute --file down.sql
npx prisma migrate resolve --rolled-back <migration_name>
```

  In development, `npm run db:migrate:reset` is almost always the right answer instead.

## Scope

Each pull request delivers exactly what its milestone issue on GitHub lists.
No cross-cutting infrastructure added early because a later milestone will want it — if no
runtime path in this PR reaches the code, it belongs in a later PR. Tests covering code already
in the PR are fine.

## Language

Vietnamese prose in `docs/`, `plans/` and `README.md`, keeping technical terms in English.
English everywhere else — code, comments, commit messages, OpenAPI descriptions.
`src/i18n/vi/*` is product content, not code.

## Reference

- `docs/system-architecture.md` — stack, API conventions, module boundaries, data model, design decisions
- GitHub issues — the ten milestones and their endpoints (`gh issue list`)
- `docs/code-standards.md` — lint, naming, commit and pull request rules

## Teaching

Learning project. The developer is an experienced Rails engineer, new to NestJS and Prisma.  
Claude writes the code and explains it afterwards in 2-4 lines, anchored to what was just  
written. Compare to Rails where the mapping holds  
(guard ≈ `before_action`, interceptor ≈ `around_action`, filter ≈ `rescue_from`) and flag where
it does not: `schema.prisma` is the source rather than generated output, there is no
`Model.find` global, migrations have no `down`, and Prisma has no polymorphic relations.
Name the approach not taken, in one sentence. Keep explanations in the conversation, no files.

Before opening a pull request, answer the three questions the mentor is most likely to ask
about the diff.
