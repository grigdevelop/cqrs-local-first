import { z } from 'zod';
import { createQuery, createMutation } from 'cqrs';

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

export const createTodoOperation = createMutation(
    'createTodo',
    z.object({ text: z.string().min(1) }),
    TodoSchema
);

export const toggleTodoOperation = createMutation(
    'toggleTodo',
    z.object({ id: z.string() }),
    z.void()
);

export const deleteTodoOperation = createMutation(
    'deleteTodo',
    z.object({ id: z.string() }),
    z.void()
);
