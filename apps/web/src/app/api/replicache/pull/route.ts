import type { PullRequestV1, PullResponseOKV1, PatchOperation } from 'replicache';
import { db } from '@/db/database';
import { rowToTodo } from '@/db/schema';

export async function POST(req: Request) {
    const pull = (await req.json()) as PullRequestV1;

    // The cookie is the server version the client last synced to.
    // On the very first pull it is null — treat that as version 0 (sync everything).
    const fromVersion = (pull.cookie as number) ?? 0;

    const [{ version: currentVersion }, changedRows, clients] = await Promise.all([
        // Read the current server version so we can return it as the new cookie.
        db
            .selectFrom('replicache_server_version')
            .select('version')
            .where('id', '=', 1)
            .executeTakeFirstOrThrow(),

        // Fetch only the rows that changed since the client's last sync.
        // This includes both live rows (put) and soft-deleted rows (del).
        db
            .selectFrom('todos')
            .selectAll()
            .where('replicache_version', '>', fromVersion)
            .execute(),

        // Fetch confirmed mutation IDs for this client group.
        db
            .selectFrom('replicache_clients')
            .selectAll()
            .where('client_group_id', '=', pull.clientGroupID)
            .execute(),
    ]);

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
