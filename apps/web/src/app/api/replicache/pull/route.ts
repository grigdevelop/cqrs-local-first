import type { PullRequestV1, PullResponseOKV1, PatchOperation } from 'replicache';
import { db } from '@/db/database';
import { rowToTodo } from '@/db/schema';

export async function POST(req: Request) {
    const pull = (await req.json()) as PullRequestV1;

    const [{ version: currentVersion }, clients] = await Promise.all([
        // Read the current server version so we can return it as the new cookie.
        db
            .selectFrom('replicache_server_version')
            .select('version')
            .where('id', '=', 1)
            .executeTakeFirstOrThrow(),

        // Fetch confirmed mutation IDs for this client group.
        db
            .selectFrom('replicache_clients')
            .selectAll()
            .where('client_group_id', '=', pull.clientGroupID)
            .execute(),
    ]);

    // The cookie is the server version the client last synced to.
    // - null on the very first pull → full sync.
    // - greater than currentVersion means the client has a stale cookie from a
    //   previous cookie format (e.g. a timestamp) → full sync to recover safely.
    const rawCookie = pull.cookie as number | null;
    const fromVersion = rawCookie != null && rawCookie <= currentVersion ? rawCookie : 0;

    const changedRows = await db
        .selectFrom('todos')
        .selectAll()
        .where('replicache_version', '>', fromVersion)
        .execute();

    // Build a typed patch from the changed rows.
    // Deleted rows become `del` ops; live rows become `put` ops.
    const patch: PatchOperation[] = changedRows.map((row): PatchOperation =>
        row.deleted
            ? { op: 'del', key: `todo/${row.id}` }
            : { op: 'put', key: `todo/${row.id}`, value: rowToTodo(row) }
    );

    // lastMutationIDChanges tells Replicache which optimistic mutations are now
    // confirmed by the server so it can stop replaying them locally.
    const lastMutationIDChanges: Record<string, number> = Object.fromEntries(
        clients.map((c) => [c.client_id, c.last_mutation_id])
    );

    const response: PullResponseOKV1 = {
        // Return the current version as the new cookie.
        // Replicache sends it back on the next pull so we can compute the diff.
        cookie: currentVersion,
        lastMutationIDChanges,
        patch,
    };

    return Response.json(response);
}
