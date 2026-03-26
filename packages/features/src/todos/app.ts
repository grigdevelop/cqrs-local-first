import { createApplication } from 'cqrs';
import type { Kysely } from 'kysely';
import { DB, GetTodosHandler, CreateTodoHandler, ToggleTodoHandler, DeleteTodoHandler } from './handlers';

/**
 * Creates and wires the todos CQRS application, binding the provided Kysely
 * database instance so all handlers receive it via dependency injection.
 *
 * Call once at application startup and export the returned instance.
 */
export function createTodoApp(db: Kysely<any>) {
    return createApplication({
        services: (container) => {
            container.bind(DB).toConstantValue(db);
        },
        queries: [GetTodosHandler],
        mutations: [CreateTodoHandler, ToggleTodoHandler, DeleteTodoHandler],
    });
}

export type TodoApplication = ReturnType<typeof createTodoApp>;
