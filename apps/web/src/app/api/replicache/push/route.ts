import type { PushRequestV1 } from 'replicache';
import { app } from '@/todos/app';
import { db, commitMutation } from '@/db/database';

export async function POST(req: Request) {
    const push = (await req.json()) as PushRequestV1;

    for (const mutation of push.mutations) {
        const { clientID, id, name, args } = mutation;

        const client = await db
            .selectFrom('replicache_clients')
            .select('last_mutation_id')
            .where('client_id', '=', clientID)
            .executeTakeFirst();

        // Skip mutations the server has already applied (at-least-once delivery guarantee).
        if (id <= (client?.last_mutation_id ?? 0)) continue;

        // Execute the business-logic mutation (updates the todos table).
        // Version stamping and last_mutation_id are handled below.
        try {
            await (app.executeMutation as (n: string, a: unknown) => Promise<unknown>)(name, args);
        } catch (e) {
            console.error(`Mutation "${name}" failed:`, e);
        }

        // Synchronous SQLite transaction: increment version, stamp the affected
        // todo row, and record the confirmed mutation ID — all as one atomic unit.
        // Because better-sqlite3 blocks the Node.js thread for the duration, no
        // concurrent pull can observe a partial state.
        const affectedId =
            typeof (args as Record<string, unknown>)?.id === 'string'
                ? ((args as Record<string, unknown>).id as string)
                : null;

        commitMutation({ clientID, clientGroupID: push.clientGroupID, mutationId: id, affectedId });
    }

    return Response.json({});
}
