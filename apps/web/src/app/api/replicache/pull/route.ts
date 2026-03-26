import type { PullRequestV1 } from 'replicache';
import { buildPullResponse } from 'replicache-sync';
import { db } from '@/db/database';
import { syncedEntities } from '@/db/entity-registry';

export async function POST(req: Request) {
    const pull = (await req.json()) as PullRequestV1;
    const response = await buildPullResponse(db, syncedEntities, pull);
    return Response.json(response);
}
