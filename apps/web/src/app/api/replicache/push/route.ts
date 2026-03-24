import { app } from '@/todos/app';
import { clientMutationIDs } from '@/lib/replicache-server';

export async function POST(req: Request) {
    const push = await req.json();

    for (const mutation of push.mutations) {
        const { clientID, id, name, args } = mutation;
        const lastID = clientMutationIDs.get(clientID) ?? 0;

        if (id <= lastID) continue; // already processed

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (app as any).executeMutation(name, args);
        } catch (e) {
            console.error(`Mutation "${name}" failed:`, e);
            // Still advance the ID to avoid infinite retries on invalid input
        }

        clientMutationIDs.set(clientID, id);
    }

    return Response.json({});
}
