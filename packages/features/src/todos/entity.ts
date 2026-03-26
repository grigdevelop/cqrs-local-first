import type { SyncedEntity } from 'replicache-sync';
import { rowToTodo, type TodoRow, type Todo } from './schema';

/**
 * Replicache sync descriptor for the todos table.
 * Add this to the entity registry in your app to enable push/pull for todos.
 */
export const todoEntity: SyncedEntity<TodoRow, Todo> = {
    tableName: 'todos',
    keyPrefix: 'todo',
    toValue: rowToTodo,
};
