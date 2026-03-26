import type { SyncedEntity } from 'replicache-sync';
import { rowToTodo, type Todo, type TodoRow } from './schema';

export const todoEntity: SyncedEntity<TodoRow, Todo> = {
    tableName: 'todos',
    keyPrefix: 'todo',
    toValue: rowToTodo,
};
