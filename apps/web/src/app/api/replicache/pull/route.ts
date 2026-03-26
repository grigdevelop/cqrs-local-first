import type { PullRequestV1 } from 'replicache';
import { buildPullResponse } from 'replicache-sync';
import { sql } from 'kysely';
import { db } from '@/db/database';
import { syncedEntities } from '@/db/entity-registry';
import { getAuthenticatedUser } from '@/auth/jwt';

export async function POST(req: Request) {
    const user = await getAuthenticatedUser(db, req);
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pull = (await req.json()) as PullRequestV1;
    const response = await buildPullResponse(db, syncedEntities, pull, {
        rowFilter: (tableName) => ['todos', 'articles'].includes(tableName) ? sql`user_id = ${user.id}` : undefined,
    });
    return Response.json(response);
}
