import { createApplication } from 'cqrs';
import type { Kysely } from 'kysely';
import { CreateTodoHandler, DB, DeleteTodoHandler, GetTodosHandler, ToggleTodoHandler } from './handlers';

export function createTodoModule(db: Kysely<any>) {
    return createApplication({
        services: (container) => {
            container.bind(DB).toConstantValue(db);
        },
        queries: [GetTodosHandler],
        mutations: [CreateTodoHandler, ToggleTodoHandler, DeleteTodoHandler],
    });
}

export type TodoModuleApplication = ReturnType<typeof createTodoModule>;
