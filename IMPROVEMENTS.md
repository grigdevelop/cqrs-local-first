# Code Quality & Structure Improvements

Analysis of `packages/features` and `apps/web`. Issues are grouped by severity.

---

## 1. Bugs and Correctness Issues

### 1.1 Articles mutations are not handled in the push route

**File:** `apps/web/src/app/api/replicache/push/route.ts`

The push route only creates a todo module and only imports `mutationEntityTable` from `features/todos`. Any article mutations sent from the client will silently fall through `processPush` — the mutation executor won't find a handler, and `getMutationEntityTable` will return `undefined` for every article operation name.

**Fix:** Merge both modules into the push handler.

```typescript
// apps/web/src/app/api/replicache/push/route.ts
import { mutationEntityTable as todoEntityTable } from 'features/todos';
import { mutationEntityTable as articleEntityTable } from 'features/articles';
import { createUserTodoApp } from '@/todos/app';
import { createUserArticleApp } from '@/articles/app';

const mergedEntityTable = new Map([...todoEntityTable, ...articleEntityTable]);

export async function POST(req: Request) {
    const user = await getAuthenticatedUser(db, req);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const push = (await req.json()) as PushRequestV1;
    const todoApp = createUserTodoApp(user.id);
    const articleApp = createUserArticleApp(user.id);

    await processPush(db, push, {
        executeMutation: async (name, args) => {
            if (todoEntityTable.has(name)) {
                return (todoApp.executeMutation as (n: string, a: unknown) => Promise<unknown>)(name, args);
            }
            return (articleApp.executeMutation as (n: string, a: unknown) => Promise<unknown>)(name, args);
        },
        getMutationEntityTable: (name) => mergedEntityTable.get(name),
        commit: commitMutation,
    });

    return Response.json({});
}
```

Longer-term, see section 3.1 for a better routing approach.

---

### 1.2 Articles are not filtered by `user_id` in the pull route (security issue)

**File:** `apps/web/src/app/api/replicache/pull/route.ts`

The `rowFilter` only applies to `todos`. The `articles` table has a `user_id` column but it is never filtered in pull, so every user pulls every other user's articles.

```typescript
// current — articles not filtered
rowFilter: (tableName) => tableName === 'todos' ? sql`user_id = ${user.id}` : undefined,

// fix — apply to all user-scoped tables
rowFilter: (tableName) =>
    tableName === 'todos' || tableName === 'articles'
        ? sql`user_id = ${user.id}`
        : undefined,
```

Alternatively, encode the filter requirement on the entity itself so it is impossible to forget (see section 3.3).

---

### 1.3 Articles table is missing from `database.ts`

**File:** `apps/web/src/db/database.ts`

The `articles` table DDL is never created. The `entity-registry.ts` exports `articleEntity` and references the `articles` table, so any pull or push touching articles will throw a SQL error at runtime.

Add the DDL and a migration for `user_id`:

```typescript
sqlite.exec(`
    -- existing tables …

    CREATE TABLE IF NOT EXISTS articles (
        id                 TEXT    PRIMARY KEY,
        user_id            TEXT    NOT NULL DEFAULT '',
        title              TEXT    NOT NULL,
        body               TEXT    NOT NULL DEFAULT '',
        published          INTEGER NOT NULL DEFAULT 0,
        deleted            INTEGER NOT NULL DEFAULT 0,
        replicache_version INTEGER NOT NULL DEFAULT 0
    );
`);
```

And add the index to the existing index block:
```typescript
sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos (user_id);
    CREATE INDEX IF NOT EXISTS articles_user_id_idx ON articles (user_id);
`);
```

---

## 2. Code Quality Issues

### 2.1 Silent `catch {}` in migrations hides real errors

**File:** `apps/web/src/db/database.ts:54–56`

```typescript
for (const sql of migrations) {
    try { sqlite.exec(sql); } catch { }
}
```

This works for "column already exists" but also swallows typos, name conflicts, and logic bugs. The standard approach is to check whether the column exists before adding it, or to use a proper migration library.

Quick fix — only ignore the specific SQLite error code for duplicate columns:

```typescript
for (const migration of migrations) {
    try {
        sqlite.exec(migration);
    } catch (err) {
        const isDuplicateColumn =
            err instanceof Error && err.message.includes('duplicate column name');
        if (!isDuplicateColumn) throw err;
    }
}
```

---

### 2.2 Hardcoded Replicache license key

**File:** `packages/features/src/modules/todos/ui/todo-module-view.tsx:44`

```typescript
licenseKey: 'l123456789',
```

License keys should come from the environment. The view is in a shared package but the key is application-specific. Options:

**Option A** — Pass it as a prop:
```typescript
type TodoModuleViewProps = { filter?: TodoFilter; licenseKey: string; };
```

**Option B** — Accept it via a `ReplicacheConfig` prop that is spread into the constructor:
```typescript
type TodoModuleViewProps = { filter?: TodoFilter; replicacheOptions?: Partial<ReplicacheOptions<typeof mutators>> };
```

Option B is more flexible and lets the host app control the name, push/pull URLs, and auth headers too.

---

### 2.3 Database filename does not reflect its scope

**File:** `apps/web/src/db/database.ts:8`

```typescript
const sqlite = new SQLite(path.join(process.cwd(), 'todos.db'));
```

The database now stores users, articles, replicache metadata, and more. `todos.db` is misleading. Rename to `app.db` (or `local.db`) and make the path configurable via an environment variable:

```typescript
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'app.db');
const sqlite = new SQLite(dbPath);
```

---

### 2.4 Repeated handler boilerplate between todos and articles

**Files:** `packages/features/src/modules/todos/application/handlers.ts`, `packages/features/src/modules/articles/application/handlers.ts`

Both modules share the exact same structure: a `DB` symbol, a `USER_ID` symbol, a get-all handler with `user_id` + `deleted` filters, a create handler, a toggle-status handler, and a delete handler. The only differences are the table name and field names.

Consider extracting a shared `createUserScopedHandlers` factory, or at a minimum creating a shared module for the DI symbols:

```typescript
// packages/features/src/shared/di-tokens.ts
export const DB = Symbol('DB');
export const USER_ID = Symbol('USER_ID');
```

Both `todos/application/handlers.ts` and `articles/application/handlers.ts` can then import from the shared location instead of declaring separate symbols with different descriptions.

> Note: currently `DB = Symbol('TODOS_DB')` and `DB = Symbol('ARTICLES_DB')` — since they are bound to separate InversifyJS containers there is no collision, but the symbol descriptions are confusing if you inspect them at runtime.

---

### 2.5 Verbose type imports in handler files

**Files:** `packages/features/src/modules/todos/application/handlers.ts`, `packages/features/src/modules/articles/application/handlers.ts`

Each handler file imports 8–12 named types from `operations.ts`:

```typescript
import {
    type CreateTodoInput, type CreateTodoOutput,
    type DeleteTodoInput, type DeleteTodoOutput,
    // … 6 more
} from '../model/operations';
```

These are derived types that can be inlined using the `Extract*` utilities that are already imported in `operations.ts`:

```typescript
// Instead of importing CreateTodoInput and using it as a parameter annotation,
// annotate inline:
async execute(input: ExtractMutationInput<typeof createTodoOperation>): Promise<ExtractMutationOutput<typeof createTodoOperation>>
```

Or re-export the extract helpers from `cqrs` and use them directly in handlers without the intermediate typedef in `operations.ts`. The intermediate typedefs are fine as documentation but create import churn.

---

### 2.6 `Kysely<any>` everywhere in handlers

**Files:** All handler files

Handlers accept `Kysely<any>`, which means Kysely's type-safe query builder provides no query validation. Column name typos, wrong `WHERE` types, and missing columns are only caught at runtime.

Because the `features` package does not know the host app's full schema, `Kysely<any>` is the pragmatic choice — but you can narrow it to the feature's own table subset:

```typescript
// packages/features/src/modules/todos/model/schema.ts
export interface TodosDatabase {
    todos: TodoTable;
}

// handlers.ts
import type { Kysely } from 'kysely';
import type { TodosDatabase } from '../model/schema';

constructor(@inject(DB) private db: Kysely<TodosDatabase>) { super(); }
```

`Kysely<TodosDatabase>` is assignable to `Kysely<AppDatabase>` (Kysely is covariant on the schema), so the host app can still pass its full `db` instance and TypeScript will accept it.

---

### 2.7 Integer booleans inserted as literals

**Files:** `packages/features/src/modules/todos/application/handlers.ts:52`, articles equivalent

```typescript
.values({ id, user_id: this.userId, text, done: 0, deleted: 0, replicache_version: 0 })
```

The schema defines `done: number` (SQLite integer). The constants `0` are correct but a future reader may expect `false`. A small helper or a named constant makes intent clear:

```typescript
const FALSE = 0 as const;
const TRUE = 1 as const;
// or simply keep 0/1 but add a comment — consistency matters more than the exact choice
```

This is minor but worth standardising across the codebase so it is not mixed with boolean-looking expressions.

---

### 2.8 Uncontrolled input in `TodoModuleView` (inconsistency)

**File:** `packages/features/src/modules/todos/ui/todo-module-view.tsx:39,65–71`

The todo input uses an uncontrolled ref:
```typescript
const inputRef = useRef<HTMLInputElement>(null);
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const text = inputRef.current?.value.trim();
    // …
    if (inputRef.current) inputRef.current.value = '';
}
```

The parent app (`todos-page-client.tsx`) uses `react-hook-form` for the auth form. Mixing patterns is fine when scopes differ, but for consistency and to gain validation, consider using `react-hook-form` here too, or extracting a controlled `<AddTodoForm>` sub-component.

---

## 3. Architecture and Structure Issues

### 3.1 DI container created per request in push handler

**Files:** `apps/web/src/app/api/replicache/push/route.ts`, `apps/web/src/todos/app.ts`, `apps/web/src/articles/app.ts`

`createUserTodoApp(user.id)` is called inside the `POST` handler, which calls `createTodoModule(db, userId)`, which calls `createApplication(...)`, which instantiates a new InversifyJS `Container` per request. DI container construction is not free.

**Recommended fix:** Keep the `db` bound once at startup. Move only the `userId` binding into a per-request child container or pass it as a plain argument:

```typescript
// Option A — child container per request (InversifyJS supports this)
const baseContainer = buildBaseContainer(db); // once, at module scope
export function createUserTodoApp(userId: string) {
    const child = baseContainer.createChild();
    child.bind(USER_ID).toConstantValue(userId);
    return createApplicationFromContainer(child, handlers);
}

// Option B — don't use DI for userId; pass it explicitly to handlers
// Each handler receives userId as a constructor param alongside db,
// or handlers accept it from the operation input.
```

Option B avoids DI for a simple string value. The `userId` is already available in `execute()` input context; injecting it via the container is overengineering for something that never varies per operation within a single request.

---

### 3.2 `todos-page-client.tsx` is a god component

**File:** `apps/web/src/app/todos-page-client.tsx`

The component (~260 lines) contains: session loading, login/register form logic, logout logic, module tab switching, auth error handling, and rendering of multiple feature modules. It is also misnamed — it is the entire app shell, not a "todos page".

Suggested breakdown:

```
apps/web/src/
  app/
    page.tsx                      — unchanged entry point
    app-shell.tsx                 — replaces todos-page-client; manages session/auth
  components/
    auth/
      auth-form.tsx               — login/register form (react-hook-form logic)
      auth-card.tsx               — the marketing + form two-column layout
    shell/
      app-header.tsx              — navbar with email, avatar, sign-out button
      module-tabs.tsx             — generic tab switcher (data-driven, not hardcoded)
      loading-screen.tsx          — the full-screen spinner card
```

The module tabs in particular should be data-driven so adding a new module does not require editing the shell:

```typescript
const MODULES = [
    { id: 'todos',    label: 'Todos',    component: <TodoModuleRoutes /> },
    { id: 'articles', label: 'Articles', component: <ArticleModuleView /> },
    { id: 'profile',  label: 'Profile',  component: <ProfileModuleView profile={user} /> },
] as const;
```

---

### 3.3 `SessionUser` type is duplicated

**File:** `apps/web/src/app/todos-page-client.tsx:10–14`

```typescript
type SessionUser = { id: string; email: string; created_at: string; };
```

This is defined locally and must be kept in sync with what the auth routes return. Extract it:

```typescript
// apps/web/src/auth/types.ts
export type SessionUser = { id: string; email: string; created_at: string; };
```

Import it in both the page client and the session route handler.

---

### 3.4 `createUserTodoApp` / `createUserArticleApp` wrapper files add no value

**Files:** `apps/web/src/todos/app.ts`, `apps/web/src/articles/app.ts`

Both files are one-line re-exports with type aliases:

```typescript
// todos/app.ts — entire file
import { createTodoModule } from 'features/todos';
import { db } from '@/db/database';
export function createUserTodoApp(userId: string) { return createTodoModule(db, userId); }
export type { TodoModuleApplication as Application } from 'features/todos';
```

The wrapper exists to partially apply `db`. That partial application could simply happen inline in the route handler, or inside a single shared `createModules(userId)` factory. Two separate files with a folder each (`src/todos/`, `src/articles/`) for a one-liner is unnecessary directory depth.

**Option:** Delete both files and import `createTodoModule` / `createArticleModule` directly in the route handlers:

```typescript
// push/route.ts
import { createTodoModule, mutationEntityTable as todoEntityTable } from 'features/todos';
import { createArticleModule, mutationEntityTable as articleEntityTable } from 'features/articles';
// …
const todoApp = createTodoModule(db, user.id);
```

---

### 3.5 Module-to-entity mapping is implicit and error-prone

**File:** `apps/web/src/db/entity-registry.ts`

```typescript
export const syncedEntities = [todoEntity, articleEntity];
```

And in `database.ts`:
```typescript
export const commitMutation = buildSqliteCommit(
    sqlite,
    syncedEntities.map(e => e.tableName),
);
```

The `syncedEntities` array drives both the pull response and the `buildSqliteCommit` table list. If a developer adds a new entity to `entity-registry.ts` but forgets to create the table in `database.ts`, push will fail silently (the version stamp UPDATE will run against a non-existent table and return 0 rows changed without error).

**Recommendation:** Make `buildSqliteCommit` verify that the tables exist at startup, or document this coupling explicitly in a comment.

---

### 3.6 Profile module has no backend

**File:** `packages/features/src/modules/profile/`

The profile module exports a `ProfileModuleView` that receives the session user as a prop and displays it — there are no CQRS handlers, no entity, and no sync. This is fine as a display-only module but its placement inside `packages/features` (which is the home of server-synced feature modules) is misleading.

**Options:**
- Move it into `apps/web/src/components/profile/` since it has no reusable backend logic.
- Or keep it in `features` but add a note that it is presentation-only, with no handlers or entity to register.

---

### 3.7 Directory structure in `features` lacks a consistent layer contract

**Current structure:**
```
packages/features/src/modules/todos/
  model/          ← schema, operations, entity
  application/    ← DI handlers, module factory
  ui/             ← React components
  index.ts
```

This is good. The inconsistency is that `model/` contains three distinct concerns:

- `schema.ts` — DB row types and conversion
- `entity.ts` — Replicache sync entity (depends on schema)
- `operations.ts` — CQRS operation definitions (independent)

A cleaner split:

```
packages/features/src/modules/todos/
  domain/
    schema.ts       ← row types, domain types, converters
    operations.ts   ← CQRS operation definitions
  sync/
    entity.ts       ← SyncedEntity (depends on domain/schema)
  application/
    handlers.ts
    module.ts
  ui/
    todo-module-view.tsx
    todo-module-routes.tsx
  index.ts
```

This makes it explicit that `sync/` is optional infrastructure for Replicache, not part of the domain model. A module that has no sync (like profile) would simply omit the `sync/` directory.

---

## 4. Minor Issues

| Location | Issue |
|---|---|
| `todo-module-view.tsx:59` | `values as Todo[]` — unsafe cast; use a Zod schema or a type guard |
| `todos-page-client.tsx:19–21` | `readJson<T>` defined locally; move to `apps/web/src/lib/fetch.ts` |
| `database.ts:8` | File hardcoded to `process.cwd()` — breaks if run from a different directory in tests |
| `handlers.ts` (both modules) | `executeTakeFirst() as { done: number }` — unsafe cast; use `selectAll` and validate the shape |
| `todo-module-view.tsx:110` | Unicode escapes (`'\u2705'`, `'\u2B1C'`) — use the literal characters or named constants for readability |
| `push/route.ts:18–20` | `app.executeMutation as (n: string, a: unknown) => Promise<unknown>` — the cast is needed because `executeMutation` is narrowly typed; exposing an `executeRaw(name, args)` on the application type would eliminate it |
| `pull/route.ts` | No `rowFilter` for future tables — adding a new synced entity without a `user_id` column will cause a SQL error. Document the assumption or add a guard in `buildPullResponse`. |

---

## Priority Order

1. **Fix** 1.3 — create the articles table (app will crash at runtime without it)
2. **Fix** 1.2 — add `user_id` filter for articles in pull (security)
3. **Fix** 1.1 — wire articles to the push handler (feature is broken)
4. **Improve** 2.1 — silence only the expected migration error
5. **Refactor** 3.2 — break up `todos-page-client.tsx`
6. **Refactor** 2.2 — pass Replicache license key via prop/env
7. **Refactor** 3.1 — avoid recreating the DI container per request
8. Everything else in sections 2 and 3 can be addressed incrementally.
