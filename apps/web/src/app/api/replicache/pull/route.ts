import type { PullRequestV1, PullResponseOKV1, PatchOperation } from 'replicache';
import { db } from '@/db/database';
import { rowToTodo } from '@/db/schema';

export async function POST(req: Request) {
    const pull = (await req.json()) as PullRequestV1;

    const { version: currentVersion } = await db
        .selectFrom('replicache_server_version')
        .select('version')
        .where('id', '=', 1)
        .executeTakeFirstOrThrow();

    // The cookie is the server version the client last synced to.
    // - null on the very first pull → full sync.
    // - greater than currentVersion means the client has a stale cookie from a
    //   previous cookie format (e.g. a timestamp) → full sync to recover safely.
    const rawCookie = pull.cookie as number | null;
    const fromVersion = rawCookie != null && rawCookie <= currentVersion ? rawCookie : 0;

    // Only include clients whose confirmation is newer than what the client
    // already knows about. For delta pulls this means confirmed_at_version >
    // fromVersion; for full syncs (fromVersion = 0) return all clients.
    // Without this filter, every pull would return all clients in the group
    // even when nothing changed, causing Replicache to warn:
    // "cookie did not change, but lastMutationIDChanges is not empty".
    const clients = await db
        .selectFrom('replicache_clients')
        .selectAll()
        .where('client_group_id', '=', pull.clientGroupID)
        .$if(fromVersion > 0, qb => qb.where('confirmed_at_version', '>', fromVersion))
        .execute();

    // fromVersion === 0 means first pull or stale/legacy cookie.
    // Return the full server state so the client cache is fully replaced —
    // a delta patch cannot remove rows the client already has locally.
    // fromVersion > 0 means a normal delta pull: only emit changed rows.
    let patch: PatchOperation[];

    if (fromVersion === 0) {
        const allRows = await db
            .selectFrom('todos')
            .selectAll()
            .where('deleted', '=', 0)
            .execute();
        patch = [
            { op: 'clear' },
            ...allRows.map((row): PatchOperation => ({
                op: 'put',
                key: `todo/${row.id}`,
                value: rowToTodo(row),
            })),
        ];
    } else {
        const changedRows = await db
            .selectFrom('todos')
            .selectAll()
            .where('replicache_version', '>', fromVersion)
            .execute();
        patch = changedRows.map((row): PatchOperation =>
            row.deleted
                ? { op: 'del', key: `todo/${row.id}` }
                : { op: 'put', key: `todo/${row.id}`, value: rowToTodo(row) }
        );
    }

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
