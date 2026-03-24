import type { Insertable, Selectable } from 'kysely';

// ---- Database table schemas ----

export interface TodoTable {
    id: string;
    text: string;
    done: number; // SQLite boolean: 0 | 1
}

export interface ReplicacheClientTable {
    client_id: string;
    client_group_id: string;
    last_mutation_id: number;
}

export interface AppDatabase {
    todos: TodoTable;
    replicache_clients: ReplicacheClientTable;
}

// ---- Kysely row helpers ----

export type TodoRow = Selectable<TodoTable>;
export type NewTodo = Insertable<TodoTable>;

// ---- Domain types (boolean done, safe to import on client) ----

export type Todo = {
    id: string;
    text: string;
    done: boolean;
};

export function rowToTodo(row: TodoRow): Todo {
    return { id: row.id, text: row.text, done: row.done !== 0 };
}
