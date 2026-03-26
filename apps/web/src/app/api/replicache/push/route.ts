import type { PushRequestV1 } from 'replicache';
import { processPush } from 'replicache-sync';
import { mutationEntityTable } from 'features/todos';
import { app } from '@/todos/app';
import { db, commitMutation } from '@/db/database';
import { getAuthenticatedUser } from '@/auth/jwt';

export async function POST(req: Request) {
    const user = await getAuthenticatedUser(db, req);
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const push = (await req.json()) as PushRequestV1;

    await processPush(db, push, {
        executeMutation: (name, args) =>
            (app.executeMutation as (n: string, a: unknown) => Promise<unknown>)(name, args),
        getMutationEntityTable: (name) => mutationEntityTable.get(name),
        commit: commitMutation,
    });

    return Response.json({});
}
