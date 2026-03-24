import { app } from '@/todos/app';
import { clientMutationIDs } from '@/lib/replicache-server';

export async function POST() {
    const todos = await app.executeQuery('getTodos', undefined);

    const patch = [
        { op: 'clear' as const },
        ...todos.map((todo) => ({
            op: 'put' as const,
            key: `todo/${todo.id}`,
            value: todo,
        })),
    ];

    return Response.json({
        cookie: Date.now(),
        lastMutationIDChanges: Object.fromEntries(clientMutationIDs),
        patch,
    });
}
