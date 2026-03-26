- create entity based on zod schema

---

Create a shared library package for Replicache server implementation that:

1. Uses Kysely for database operations (database-agnostic)
2. Provides a framework for easily defining new entities and features
3. Can be integrated into any project (Next.js, Express, etc.)
4. Handles:
   - Client state management (client_id, client_group_id, last_mutation_id)
   - Server version tracking
   - Atomic mutation commits
   - Push/pull request handling
   - Entity CRUD operations with automatic version stamping

Requirements:
- TypeScript with full type safety
- Generic entity definition system
- Pluggable mutation handlers
- Reusable pull/push endpoint logic
- No hard-coded database schema (should be extensible)
- Integration with existing CQRS pattern from packages/cqrs

The library should allow projects to:
```typescript
// Define entities
const Todo = defineEntity('todos', todoSchema);

// Register mutations
const mutations = [createTodo, updateTodo, deleteTodo];

// Create Replicache server instance
const replicache = createReplicacheServer({ db, entities: [Todo], mutations });

// Use in API routes
export const POST = replicache.handlePush;
export const GET = replicache.handlePull;
```

import { z } from 'zod';
import { ColumnType } from 'kysely';

type ZodToKyselyType<T extends z.ZodTypeAny> = T extends z.ZodString
  ? ColumnType<string>
  : T extends z.ZodNumber
  ? ColumnType<number>
  : T extends z.ZodBoolean
  ? ColumnType<boolean>
  : T extends z.ZodDate
  ? ColumnType<Date>
  : T extends z.ZodOptional<infer U>
  ? ZodToKyselyType<U> | null
  : T extends z.ZodNullable<infer U>
  ? ZodToKyselyType<U> | null
  : ColumnType<unknown>;

type ZodSchemaToKyselyTable<T extends z.ZodObject<any>> = {
  [K in keyof T['shape']]: ZodToKyselyType<T['shape'][K]>;
};

function zodSchemaToKyselyTable<T extends z.ZodObject<any>>(
  schema: T
): ZodSchemaToKyselyTable<T> {
  return {} as ZodSchemaToKyselyTable<T>;
}


---

refactor features project.
src/application.ts as the entry point for all features.
src/shell.tsx as the shell for all features. (contains routes configuration)
React context and provider for providing Replicache instance to all features.


---

┌──────────┬──────────────────────────────────────────┐
  │ Priority │                   Item                   │
  ├──────────┼──────────────────────────────────────────┤
  │ High     │ Export entities.ts from index.ts         │
  ├──────────┼──────────────────────────────────────────┤
  │ High     │ Output validation (or document the skip) │
  ├──────────┼──────────────────────────────────────────┤
  │ High     │ Delete / move source.ts                  │
  ├──────────┼──────────────────────────────────────────┤
  │ Medium   │ Structured error types                   │
  ├──────────┼──────────────────────────────────────────┤
  │ Medium   │ Pipeline / middleware behaviors          │
  ├──────────┼──────────────────────────────────────────┤
  │ Low      │ Domain events / event bus                │
  ├──────────┼──────────────────────────────────────────┤
  │ Low      │ Request-scoped DI                        │
  ├──────────┼──────────────────────────────────────────┤
  │ Low      │ Query/mutation kind enforcement          │
  └──────────┴──────────────────────────────────────────┘