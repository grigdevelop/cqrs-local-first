export type Todo = {
    id: string;
    text: string;
    done: boolean;
};

// Module-level store — persists for the lifetime of the server process.
const todos = new Map<string, Todo>();

export const store = {
    getAll: (): Todo[] => Array.from(todos.values()),

    create: (text: string): Todo => {
        const todo: Todo = { id: crypto.randomUUID(), text, done: false };
        todos.set(todo.id, todo);
        return todo;
    },

    toggle: (id: string): void => {
        const todo = todos.get(id);
        if (todo) todos.set(id, { ...todo, done: !todo.done });
    },

    delete: (id: string): void => {
        todos.delete(id);
    },
};
