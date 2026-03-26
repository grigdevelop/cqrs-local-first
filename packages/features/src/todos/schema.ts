import type { Selectable, Insertable } from 'kysely';

// ---- Kysely table interface ----

export interface TodoTable {
    id: string;
    text: string;
    done: number;               // SQLite boolean: 0 | 1
    deleted: number;            // soft-delete flag: 0 | 1
    replicache_version: number; // server version when this row was last modified
}

export type TodoRow = Selectable<TodoTable>;
export type NewTodo = Insertable<TodoTable>;

// ---- Domain type (boolean done, safe to use on client) ----

export type Todo = {
    id: string;
    text: string;
    done: boolean;
};

export function rowToTodo(row: TodoRow): Todo {
    return { id: row.id, text: row.text, done: row.done !== 0 };
}
