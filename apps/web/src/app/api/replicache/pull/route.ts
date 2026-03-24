import { app } from '@/todos/app';
import { db } from '@/db/database';

export async function POST() {
    const [todos, clients] = await Promise.all([
        app.executeQuery('getTodos', undefined),
        db.selectFrom('replicache_clients').selectAll().execute(),
    ]);

    return Response.json({
        cookie: Date.now(),
        lastMutationIDChanges: Object.fromEntries(
            clients.map((c) => [c.client_id, c.last_mutation_id])
        ),
        patch: [
            { op: 'clear' },
            ...todos.map((todo) => ({ op: 'put', key: `todo/${todo.id}`, value: todo })),
        ],
    });
}
