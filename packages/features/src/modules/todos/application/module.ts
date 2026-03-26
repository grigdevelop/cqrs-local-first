import { createApplication } from 'cqrs';
import type { Kysely } from 'kysely';
import { CreateTodoHandler, DB, DeleteTodoHandler, GetTodosHandler, ToggleTodoHandler, USER_ID } from './handlers';

export function createTodoModule(db: Kysely<any>, userId: string) {
    return createApplication({
        services: (container) => {
            container.bind(DB).toConstantValue(db);
            container.bind(USER_ID).toConstantValue(userId);
        },
        queries: [GetTodosHandler],
        mutations: [CreateTodoHandler, ToggleTodoHandler, DeleteTodoHandler],
    });
}

export type TodoModuleApplication = ReturnType<typeof createTodoModule>;
