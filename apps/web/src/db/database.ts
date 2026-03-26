import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import path from 'path';
import type { AppDatabase } from './schema';
import { buildSqliteCommit } from 'replicache-sync';
import { syncedEntities } from './entity-registry';

const sqlite = new SQLite(path.join(process.cwd(), 'todos.db'));

sqlite.exec(`
    CREATE TABLE IF NOT EXISTS todos (
        id   TEXT    PRIMARY KEY,
        text TEXT    NOT NULL,
        done INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS replicache_clients (
        client_id        TEXT    PRIMARY KEY,
        client_group_id  TEXT    NOT NULL DEFAULT '',
        last_mutation_id INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS replicache_server_version (
        id      INTEGER PRIMARY KEY DEFAULT 1,
        version INTEGER NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO replicache_server_version (id, version) VALUES (1, 0);
`);

// If the version counter is still at the bootstrap value of 0, advance it to the
// current millisecond timestamp. This ensures the first cookie we issue is always
// ≥ any legacy timestamp cookie a browser may have stored from a previous schema
// where Date.now() was used directly as the cookie value.
{
    const row = sqlite
        .prepare<[], { version: number }>('SELECT version FROM replicache_server_version WHERE id = 1')
        .get()!;
    if (row.version === 0) {
        sqlite.prepare('UPDATE replicache_server_version SET version = ? WHERE id = 1').run(Date.now());
    }
}

// Migrations for databases created before these columns existed.
const migrations: string[] = [
    `ALTER TABLE replicache_clients ADD COLUMN client_group_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE replicache_clients ADD COLUMN confirmed_at_version INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE todos ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE todos ADD COLUMN replicache_version INTEGER NOT NULL DEFAULT 0`,
];
for (const sql of migrations) {
    try { sqlite.exec(sql); } catch { /* column already exists */ }
}

export const db = new Kysely<AppDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
});

// ---------------------------------------------------------------------------
// Synchronous atomic commit for push mutations
//
// The three writes below MUST be visible to concurrent pull requests as a
// unit: version++, row stamp, last_mutation_id. Using better-sqlite3's
// synchronous sqlite.transaction() is the only correct way to achieve this —
// it blocks the Node.js thread for its duration, so no async pull handler can
// interleave and observe a partial state.
//
// Kysely's async db.transaction() does NOT work here: every `await` inside it
// yields the event loop, and a concurrent pull using the same SQLite connection
// can read uncommitted writes on that connection mid-transaction.
// ---------------------------------------------------------------------------

export const commitMutation = buildSqliteCommit(
    sqlite,
    syncedEntities.map(e => e.tableName),
);
export type { CommitMutationParams, AffectedRow } from 'replicache-sync';

