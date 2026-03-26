# Repository Guidelines

## Project Structure & Module Organization
This repository is an npm workspace managed from the root `package.json`.

- `apps/web`: Next.js app, API routes, database wiring, and Playwright E2E tests in `apps/web/e2e`.
- `packages/cqrs`: shared CQRS primitives and unit tests beside source files.
- `packages/replicache-sync`: reusable Replicache pull/push helpers with tests under `src/__tests__`.
- `packages/features`: feature modules; `src/todos/` is the current reference implementation.
- `docs/`: project notes and design scratch files.

Keep new code close to the owning package. Prefer feature folders like `src/<feature>/` and use `index.ts` exports for package entry points.

## Build, Test, and Development Commands
- `npm test`: runs the root Vitest workspace across `packages/*` and `apps/*`.
- `npm run test:watch`: watch mode for cross-package unit testing.
- `npm --prefix apps/web run dev`: starts the web app on `http://localhost:3000`.
- `npm --prefix apps/web run build`: production build for the Next.js app.
- `npm --prefix apps/web run e2e`: runs Playwright tests in `apps/web/e2e`.
- `npm --prefix <package> run compile`: TypeScript type-check for an individual package, for example `npm --prefix packages/cqrs run compile`.

## Coding Style & Naming Conventions
TypeScript is the default across apps and packages. Follow the surrounding file style: existing code uses semicolons, single quotes, and mostly 4-space indentation in application code. Use:

- `PascalCase` for React components and exported types.
- `camelCase` for functions, variables, and mutator names.
- `kebab-case` for package names and spec files when separated from source.

No dedicated formatter or ESLint config is checked in, so keep diffs small and consistent with neighboring files.

## Testing Guidelines
Vitest is the unit test runner; Playwright covers browser flows in `apps/web`. Name unit tests `*.spec.ts` and place them beside source or under `src/__tests__`. Run focused checks before opening a PR, especially for touched packages. Keep Playwright tests serial-safe because the app uses SQLite with a single-writer constraint.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits such as `feat: ...` and `refactor: ...`. Continue with prefixes like `feat`, `fix`, `refactor`, and `test`, written in the imperative mood. PRs should include a short summary, affected packages, linked issues, and screenshots or terminal output when UI or sync behavior changes.
