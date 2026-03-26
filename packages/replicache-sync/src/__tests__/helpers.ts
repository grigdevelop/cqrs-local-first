import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { SyncedEntity, SyncRow } from '../types';
import { buildSqliteCommit } from '../sqlite-commit';

// ---------------------------------------------------------------------------
// Generic "items" entity — proves the library is not coupled to any specific
// domain (todos, users, etc.).
// ---------------------------------------------------------------------------

export interface ItemRow extends SyncRow {
    value: string;
}

export interface Item {
    id: string;
    value: string;
}

export const itemsEntity: SyncedEntity<ItemRow, Item> = {
    tableName: 'items',
    keyPrefix: 'item',
    toValue: (row) => ({ id: row.id, value: row.value }),
};

// ---------------------------------------------------------------------------
// Minimal DB schema required by the library
// ---------------------------------------------------------------------------

export interface ItemsTable {
    id: string;
    value: string;
    deleted: number;
    replicache_version: number;
}

export interface ReplicacheClientsTable {
    client_id: string;
    client_group_id: string;
    last_mutation_id: number;
    confirmed_at_version: number;
}

export interface ReplicacheServerVersionTable {
    id: number;
    version: number;
}

export interface TestDatabase {
    items: ItemsTable;
    replicache_clients: ReplicacheClientsTable;
    replicache_server_version: ReplicacheServerVersionTable;
}

// ---------------------------------------------------------------------------
// Factory — creates a fresh in-memory DB for each test
// ---------------------------------------------------------------------------

export function createTestDb() {
    const sqlite = new SQLite(':memory:');

    sqlite.exec(`
        CREATE TABLE items (
            id                 TEXT    PRIMARY KEY,
            value              TEXT    NOT NULL,
            deleted            INTEGER NOT NULL DEFAULT 0,
            replicache_version INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE replicache_clients (
            client_id            TEXT    PRIMARY KEY,
            client_group_id      TEXT    NOT NULL DEFAULT '',
            last_mutation_id     INTEGER NOT NULL DEFAULT 0,
            confirmed_at_version INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE replicache_server_version (
            id      INTEGER PRIMARY KEY DEFAULT 1,
            version INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO replicache_server_version (id, version) VALUES (1, 1);
    `);

    const db = new Kysely<TestDatabase>({ dialect: new SqliteDialect({ database: sqlite }) });
    const commit = buildSqliteCommit(sqlite, ['items']);

    return { sqlite, db, commit };
}
