import { app } from '@/todos/app';
import { db } from '@/db/database';

// Typed dispatch — keeps the route decoupled from handler internals
const dispatch: Record<string, ((args: unknown) => Promise<unknown>) | undefined> = {
    createTodo: (args) => app.executeMutation('createTodo', args as { text: string }),
    toggleTodo: (args) => app.executeMutation('toggleTodo', args as { id: string }),
    deleteTodo: (args) => app.executeMutation('deleteTodo', args as { id: string }),
};

export async function POST(req: Request) {
    const push = await req.json();

    for (const mutation of push.mutations) {
        const { clientID, id, name, args } = mutation;

        const client = await db
            .selectFrom('replicache_clients')
            .select('last_mutation_id')
            .where('client_id', '=', clientID)
            .executeTakeFirst();

        if (id <= (client?.last_mutation_id ?? 0)) continue;

        const handler = dispatch[name];
        if (handler) {
            try {
                await handler(args);
            } catch (e) {
                console.error(`Mutation "${name}" failed:`, e);
            }
        }

        await db
            .insertInto('replicache_clients')
            .values({ client_id: clientID, last_mutation_id: id })
            .onConflict(oc => oc.column('client_id').doUpdateSet({ last_mutation_id: id }))
            .execute();
    }

    return Response.json({});
}
