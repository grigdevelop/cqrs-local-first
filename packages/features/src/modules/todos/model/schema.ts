import type { Insertable, Selectable } from 'kysely';

export interface TodoTable {
    id: string;
    text: string;
    done: number;
    deleted: number;
    replicache_version: number;
}

export type TodoRow = Selectable<TodoTable>;
export type NewTodo = Insertable<TodoTable>;

export type Todo = {
    id: string;
    text: string;
    done: boolean;
};

export function rowToTodo(row: TodoRow): Todo {
    return { id: row.id, text: row.text, done: row.done !== 0 };
}
