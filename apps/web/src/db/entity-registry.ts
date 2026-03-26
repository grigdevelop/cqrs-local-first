import type { SyncedEntity } from './schema';
import { rowToTodo, type TodoRow, type Todo } from './schema';

/**
 * All entity tables that participate in Replicache sync.
 *
 * To add a new entity:
 *   1. Add its table DDL and Kysely interface to schema.ts / database.ts
 *   2. Append an entry here — pull, push, and commitMutation pick it up automatically
 */
export const syncedEntities: SyncedEntity<TodoRow, Todo>[] = [
    {
        tableName: 'todos',
        keyPrefix: 'todo',
        toValue: rowToTodo,
    },
];
