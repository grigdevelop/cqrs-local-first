import type Database from 'better-sqlite3';

export interface CommitMutationParams {
    clientID: string;
    clientGroupID: string;
    mutationId: number;
    /** ID of the todo row touched by this mutation, or null for mutations that
     *  failed before touching any row (still need the version bump). */
    affectedId: string | null;
}

/**
 * Returns a synchronous SQLite transaction that atomically:
 *   1. Increments the global server version counter
 *   2. Stamps `replicache_version` on the affected todo row (if any)
 *   3. Upserts the client record with the new `last_mutation_id` and `confirmed_at_version`
 *
 * Accepts any better-sqlite3 Database instance so the same logic is shared
 * between production (file-based DB) and tests (in-memory DB).
 */
export function buildCommitMutation(sqlite: Database.Database) {
    const _incVersion = sqlite.prepare(
        'UPDATE replicache_server_version SET version = version + 1 WHERE id = 1'
    );
    const _getVersion = sqlite.prepare<[], { version: number }>(
        'SELECT version FROM replicache_server_version WHERE id = 1'
    );
    const _stampTodo = sqlite.prepare(
        'UPDATE todos SET replicache_version = ? WHERE id = ?'
    );
    const _upsertClient = sqlite.prepare(`
        INSERT INTO replicache_clients (client_id, client_group_id, last_mutation_id, confirmed_at_version)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (client_id) DO UPDATE SET
            client_group_id      = excluded.client_group_id,
            last_mutation_id     = excluded.last_mutation_id,
            confirmed_at_version = excluded.confirmed_at_version
    `);

    return sqlite.transaction(
        ({ clientID, clientGroupID, mutationId, affectedId }: CommitMutationParams): void => {
            _incVersion.run();
            const { version } = _getVersion.get()!;
            if (affectedId !== null) _stampTodo.run(version, affectedId);
            _upsertClient.run(clientID, clientGroupID, mutationId, version);
        }
    );
}
