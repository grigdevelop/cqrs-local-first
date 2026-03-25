import { db } from '@/db/database';

/**
 * Resets all application state to a clean slate.
 * Only available outside production — used by e2e tests in beforeEach.
 */
export async function POST() {
    if (process.env.NODE_ENV === 'production') {
        return new Response('Forbidden', { status: 403 });
    }

    await db.deleteFrom('todos').execute();
    await db.deleteFrom('replicache_clients').execute();
    // Reset version to the current timestamp rather than a small integer.
    // Replicache requires cookies to be monotonically non-decreasing: if the
    // server returned a cookie smaller than the browser's stored snapshot cookie,
    // Replicache would throw "Received cookie X is < than last snapshot cookie Y"
    // and ignore the pull response. Using Date.now() ensures the new version is
    // always ≥ any cookie a browser may have stored from a previous session.
    await db
        .updateTable('replicache_server_version')
        .set({ version: Date.now() })
        .where('id', '=', 1)
        .execute();

    return Response.json({ ok: true });
}
