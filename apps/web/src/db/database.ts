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

    CREATE TABLE IF NOT EXISTS articles (
        id        TEXT PRIMARY KEY,
        title     TEXT NOT NULL,
        body      TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL
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

{
    const row = sqlite.prepare<[], { version: number }>('SELECT version FROM replicache_server_version WHERE id = 1').get()!;
    if (row.version === 0) {
        sqlite.prepare('UPDATE replicache_server_version SET version = ? WHERE id = 1').run(Date.now());
    }
}

const migrations: string[] = [
    `ALTER TABLE replicache_clients ADD COLUMN client_group_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE replicache_clients ADD COLUMN confirmed_at_version INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE todos ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE todos ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE todos ADD COLUMN replicache_version INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE articles ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE articles ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE articles ADD COLUMN replicache_version INTEGER NOT NULL DEFAULT 0`,
];
for (const sql of migrations) {
    try { sqlite.exec(sql); } catch { }
}
sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos (user_id);
    CREATE INDEX IF NOT EXISTS articles_user_id_idx ON articles (user_id);
`);

export const db = new Kysely<AppDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
});

export const commitMutation = buildSqliteCommit(
    sqlite,
    syncedEntities.map(e => e.tableName),
);
export type { CommitMutationParams, AffectedRow } from 'replicache-sync';
