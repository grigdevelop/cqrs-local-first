import type Database from 'better-sqlite3';
import type { CommitFn, CommitMutationParams } from './types';

/**
 * Returns a synchronous SQLite transaction (CommitFn) that atomically:
 *   1. Increments the global server version counter
 *   2. Stamps `replicache_version` on the affected row (if any)
 *   3. Upserts the client record with the new `last_mutation_id` and `confirmed_at_version`
 *
 * Uses better-sqlite3's synchronous sqlite.transaction() — the only correct
 * approach for a single-file SQLite DB, since async transactions yield the
 * event loop and allow a concurrent pull handler to read partial state.
 *
 * @param sqlite     A better-sqlite3 Database instance.
 * @param tableNames All entity table names that may be stamped; a prepared
 *                   statement is compiled per table at construction time so
 *                   the hot transaction path never builds dynamic SQL.
 */
export function buildSqliteCommit(sqlite: Database.Database, tableNames: string[]): CommitFn {
    const _incVersion = sqlite.prepare(
        'UPDATE replicache_server_version SET version = version + 1 WHERE id = 1'
    );
    const _getVersion = sqlite.prepare<[], { version: number }>(
        'SELECT version FROM replicache_server_version WHERE id = 1'
    );

    // tableNames comes from the developer-controlled entity registry, not user input.
    const _stampStatements = new Map(
        tableNames.map(name => [
            name,
            sqlite.prepare(`UPDATE ${name} SET replicache_version = ? WHERE id = ?`),
        ])
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
        ({ clientID, clientGroupID, mutationId, affectedRow }: CommitMutationParams): void => {
            _incVersion.run();
            const { version } = _getVersion.get()!;
            if (affectedRow !== null) {
                _stampStatements.get(affectedRow.tableName)?.run(version, affectedRow.id);
            }
            _upsertClient.run(clientID, clientGroupID, mutationId, version);
        }
    );
}
