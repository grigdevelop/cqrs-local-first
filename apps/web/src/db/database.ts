import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import path from 'path';
import type { AppDatabase } from './schema';

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

// Migrations for databases created before these columns existed.
const migrations: string[] = [
    `ALTER TABLE replicache_clients ADD COLUMN client_group_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE todos ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE todos ADD COLUMN replicache_version INTEGER NOT NULL DEFAULT 0`,
];
for (const sql of migrations) {
    try { sqlite.exec(sql); } catch { /* column already exists */ }
}

export const db = new Kysely<AppDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
});

// Atomically increments the global server version and returns the new value.
// Called inside every mutation handler so each write gets a unique, ordered stamp.
// Uses the raw sqlite instance for a synchronous RETURNING query — Kysely's SQLite
// dialect does not expose RETURNING for UPDATE statements.
const nextVersionStmt = sqlite.prepare<[], { version: number }>(
    'UPDATE replicache_server_version SET version = version + 1 WHERE id = 1 RETURNING version'
);

export function getNextVersion(): number {
    return nextVersionStmt.get()!.version;
}
