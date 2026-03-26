import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { getAuthCookieName, signJwt } from '@/auth/jwt';

const dbRef = vi.hoisted((): { sqlite: Database.Database | null } => ({ sqlite: null }));

vi.mock('@/db/database', async () => {
    const { default: SQLite } = await import('better-sqlite3');
    const { Kysely, SqliteDialect } = await import('kysely');
    const { buildSqliteCommit } = await import('replicache-sync');

    const sqlite = new SQLite(':memory:');
    sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE todos (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, replicache_version INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE articles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, replicache_version INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE replicache_clients (client_id TEXT PRIMARY KEY, client_group_id TEXT NOT NULL DEFAULT '', last_mutation_id INTEGER NOT NULL DEFAULT 0, confirmed_at_version INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE replicache_server_version (id INTEGER PRIMARY KEY DEFAULT 1, version INTEGER NOT NULL DEFAULT 0);
        INSERT INTO replicache_server_version (id, version) VALUES (1, 1);
    `);

    dbRef.sqlite = sqlite;
    const db = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    const commitMutation = buildSqliteCommit(sqlite, ['todos', 'articles']);
    return { db, commitMutation };
});

import { POST as pushPOST } from '@/app/api/replicache/push/route';
import { POST as pullPOST } from '@/app/api/replicache/pull/route';

const USER_1 = { id: 'user-1', email: 'user@example.com', created_at: '2026-01-01T00:00:00.000Z' };
const USER_2 = { id: 'user-2', email: 'other@example.com', created_at: '2026-01-02T00:00:00.000Z' };

function makeRequest(body: unknown, user = USER_1) {
    return new Request('http://localhost', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `${getAuthCookieName()}=${signJwt(user)}`,
        },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    dbRef.sqlite!.exec(`
        DELETE FROM users;
        DELETE FROM todos;
        DELETE FROM articles;
        DELETE FROM replicache_clients;
        UPDATE replicache_server_version SET version = 1;
        INSERT INTO users (id, email, password_hash, created_at) VALUES ('user-1', 'user@example.com', 'hash', '2026-01-01T00:00:00.000Z');
        INSERT INTO users (id, email, password_hash, created_at) VALUES ('user-2', 'other@example.com', 'hash', '2026-01-02T00:00:00.000Z');
    `);
});

describe('articles sync', () => {
    it('creates and pulls articles for the authenticated user', async () => {
        await pushPOST(makeRequest({
            profileID: 'profile-1',
            clientGroupID: 'group-1',
            pushVersion: 1,
            mutations: [{ clientID: 'client-1', id: 1, timestamp: Date.now(), name: 'createArticle', args: { id: 'article-1', title: 'First article', body: 'Body copy' } }],
        }));

        const row = dbRef.sqlite!.prepare('SELECT * FROM articles WHERE id = ?').get('article-1') as any;
        expect(row.user_id).toBe(USER_1.id);

        const res = await pullPOST(makeRequest({ profileID: 'profile-1', clientGroupID: 'group-1', cookie: null, pullVersion: 1 }));
        const body = await res.json();
        expect(body.patch).toContainEqual({
            op: 'put',
            key: 'article/article-1',
            value: { id: 'article-1', title: 'First article', body: 'Body copy', published: false },
        });
    });

    it("does not return another user's articles", async () => {
        dbRef.sqlite!.prepare('INSERT INTO articles VALUES (?, ?, ?, ?, 0, 0, 1)').run('article-1', USER_1.id, 'Mine', 'Body');
        dbRef.sqlite!.prepare('INSERT INTO articles VALUES (?, ?, ?, ?, 0, 0, 1)').run('article-2', USER_2.id, 'Theirs', 'Secret');

        const res = await pullPOST(makeRequest({ profileID: 'profile-1', clientGroupID: 'group-1', cookie: null, pullVersion: 1 }, USER_1));
        const body = await res.json();
        const keys = body.patch.map((op: any) => op.key);
        expect(keys).toContain('article/article-1');
        expect(keys).not.toContain('article/article-2');
    });
});

