import type { PullRequestV1, PullResponseOKV1, PatchOperation } from 'replicache';
import { app } from '@/todos/app';
import { db } from '@/db/database';

export async function POST(req: Request) {
    // Parse the typed pull request body.
    // Replicache sends pullVersion, clientGroupID, cookie, and profileID.
    // We only need clientGroupID (to scope lastMutationIDChanges) and cookie
    // (to implement delta sync — ignored here in favour of the simpler reset strategy).
    const pull = (await req.json()) as PullRequestV1;

    const [todos, clients] = await Promise.all([
        app.executeQuery('getTodos', undefined),
        // Fetch every client that belongs to this client group.
        // A client group is the set of tabs/windows sharing the same Replicache instance name.
        db
            .selectFrom('replicache_clients')
            .selectAll()
            .where('client_group_id', '=', pull.clientGroupID)
            .execute(),
    ]);

    // lastMutationIDChanges tells Replicache which pending (optimistic) mutations
    // have been confirmed by the server. Each entry maps a clientID to the highest
    // mutation ID the server has already processed for that client.
    // Replicache uses this to discard optimistic updates that are now authoritative.
    const lastMutationIDChanges: Record<string, number> = Object.fromEntries(
        clients.map((c) => [c.client_id, c.last_mutation_id])
    );

    // The patch is a list of operations Replicache applies to its local key-value store.
    //
    // "Reset" strategy (used here): clear everything, then re-put the full server state.
    // This is the simplest correct approach and works well for small datasets.
    //
    // Alternative — delta sync: compare the request `cookie` (last-seen server version)
    // against the current version and only emit `put`/`del` ops for changed keys.
    // Delta sync reduces bandwidth but requires tracking change history on the server.
    const patch: PatchOperation[] = [
        { op: 'clear' },
        ...todos.map((todo): PatchOperation => ({
            op: 'put',
            key: `todo/${todo.id}`,
            value: todo,
        })),
    ];

    // The cookie is an opaque value returned to the client and sent back on the next pull.
    // For the reset strategy a monotonically increasing timestamp is sufficient —
    // we don't actually use the incoming cookie value because we always return full state.
    // For delta sync you would store a server-side version counter and use it here.
    const cookie = Date.now();

    const response: PullResponseOKV1 = {
        cookie,
        lastMutationIDChanges,
        patch,
    };

    return Response.json(response);
}
