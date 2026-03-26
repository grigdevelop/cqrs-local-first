import { z } from 'zod';
import {
    createMutation,
    createQuery,
    ExtractMutationInput,
    ExtractMutationOutput,
    ExtractQueryInput,
    ExtractQueryOutput,
} from 'cqrs';

export const TodoSchema = z.object({
    id: z.string(),
    text: z.string(),
    done: z.boolean(),
});

export const getTodosOperation = createQuery(
    'getTodos',
    z.void(),
    z.array(TodoSchema)
);

export type GetTodosInput = ExtractQueryInput<typeof getTodosOperation>;
export type GetTodosOutput = ExtractQueryOutput<typeof getTodosOperation>;

export const createTodoOperation = createMutation(
    'createTodo',
    z.object({ id: z.string(), text: z.string().min(1) }),
    TodoSchema
);

export type CreateTodoInput = ExtractMutationInput<typeof createTodoOperation>;
export type CreateTodoOutput = ExtractMutationOutput<typeof createTodoOperation>;

export const toggleTodoOperation = createMutation(
    'toggleTodo',
    z.object({ id: z.string() }),
    z.void()
);

export type ToggleTodoInput = ExtractMutationInput<typeof toggleTodoOperation>;
export type ToggleTodoOutput = ExtractMutationOutput<typeof toggleTodoOperation>;

export const deleteTodoOperation = createMutation(
    'deleteTodo',
    z.object({ id: z.string() }),
    z.void()
);

export type DeleteTodoInput = ExtractMutationInput<typeof deleteTodoOperation>;
export type DeleteTodoOutput = ExtractMutationOutput<typeof deleteTodoOperation>;

export const mutationEntityTable = new Map<string, string | null>([
    [createTodoOperation.type, 'todos'],
    [toggleTodoOperation.type, 'todos'],
    [deleteTodoOperation.type, 'todos'],
]);
