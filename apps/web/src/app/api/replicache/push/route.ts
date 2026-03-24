import type { PushRequestV1 } from 'replicache';
import { app } from '@/todos/app';
import { db } from '@/db/database';

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

        try {
            await app.executeMutation(name, args as Record<string, unknown>);
        } catch (e) {
            console.error(`Mutation "${name}" failed:`, e);
        }

        // Record the highest processed mutation ID for this client so the pull
        // response can report it back via lastMutationIDChanges.
        await db
            .insertInto('replicache_clients')
            .values({ client_id: clientID, client_group_id: push.clientGroupID, last_mutation_id: id })
            .onConflict(oc =>
                oc.column('client_id').doUpdateSet({
                    client_group_id: push.clientGroupID,
                    last_mutation_id: id,
                })
            )
            .execute();
    }

    return Response.json({});
}
