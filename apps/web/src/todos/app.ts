import { createApplication } from 'cqrs';
import { GetTodosHandler } from './handlers';
import { CreateTodoHandler, ToggleTodoHandler, DeleteTodoHandler } from './handlers';

export const app = createApplication({
    queries: [GetTodosHandler],
    mutations: [CreateTodoHandler, ToggleTodoHandler, DeleteTodoHandler],
});

export type Application = typeof app;