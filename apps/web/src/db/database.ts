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
`);

// Migrate existing databases that pre-date the client_group_id column.
try {
    sqlite.exec(`ALTER TABLE replicache_clients ADD COLUMN client_group_id TEXT NOT NULL DEFAULT ''`);
} catch {
    // Column already exists — safe to ignore.
}

export const db = new Kysely<AppDatabase>({
    dialect: new SqliteDialect({ database: sqlite }),
});
