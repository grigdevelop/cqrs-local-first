import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { getAuthCookieName, signJwt } from '@/auth/jwt';

const dbRef = vi.hoisted((): { sqlite: Database.Database | null } => ({ sqlite: null }));

vi.mock('@/db/database', async () => {
    const { default: SQLite } = await import('better-sqlite3');
    const { Kysely, SqliteDialect } = await import('kysely');
    const { buildSqliteCommit } = await import('replicache-sync');

    const sqlite = new SQLite(':memory:');

    sqlite.exec(`
        CREATE TABLE users (
            id                TEXT    PRIMARY KEY,
            email             TEXT    NOT NULL UNIQUE,
            password_hash     TEXT    NOT NULL,
            created_at        TEXT    NOT NULL
        );
        CREATE TABLE todos (
            id                 TEXT    PRIMARY KEY,
            user_id            TEXT    NOT NULL,
            text               TEXT    NOT NULL,
            done               INTEGER NOT NULL DEFAULT 0,
            deleted            INTEGER NOT NULL DEFAULT 0,
            replicache_version INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE articles (
            id                 TEXT    PRIMARY KEY,
            user_id            TEXT    NOT NULL,
            title              TEXT    NOT NULL,
            body               TEXT    NOT NULL,
            published          INTEGER NOT NULL DEFAULT 0,
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

    dbRef.sqlite = sqlite;

    const db = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    const commitMutation = buildSqliteCommit(sqlite, ['todos', 'articles']);

    return { db, commitMutation };
});

import { POST as pushPOST } from '@/app/api/replicache/push/route';
import { POST as pullPOST } from '@/app/api/replicache/pull/route';

const CLIENT_GROUP = 'group-1';
const CLIENT_ID = 'client-1';
const USER_1 = { id: 'user-1', email: 'user@example.com', created_at: '2026-01-01T00:00:00.000Z' };
const USER_2 = { id: 'user-2', email: 'other@example.com', created_at: '2026-01-02T00:00:00.000Z' };

function authCookie(user = USER_1) {
    return `${getAuthCookieName()}=${signJwt(user)}`;
}

function makeRequest(body: unknown, user = USER_1): Request {
    return new Request('http://localhost', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: authCookie(user),
        },
        body: JSON.stringify(body),
    });
}

function pushBody(mutations: { clientID?: string; id: number; name: string; args: unknown }[]) {
    return {
        profileID: 'profile-1',
        clientGroupID: CLIENT_GROUP,
        pushVersion: 1,
        mutations: mutations.map(({ clientID = CLIENT_ID, ...rest }) => ({
            clientID,
            timestamp: Date.now(),
            ...rest,
        })),
    };
}

function pullBody(cookie: number | null = null) {
    return { profileID: 'profile-1', clientGroupID: CLIENT_GROUP, cookie, pullVersion: 1 };
}

beforeEach(() => {
    dbRef.sqlite!.exec(`
        DELETE FROM users;
        DELETE FROM todos;
        DELETE FROM replicache_clients;
        UPDATE replicache_server_version SET version = 1;
        INSERT INTO users (id, email, password_hash, created_at) VALUES ('user-1', 'user@example.com', 'hash', '2026-01-01T00:00:00.000Z');
        INSERT INTO users (id, email, password_hash, created_at) VALUES ('user-2', 'other@example.com', 'hash', '2026-01-02T00:00:00.000Z');
    `);
});

describe('push', () => {
    it('creates a todo for the authenticated user', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Buy milk' } },
        ])));

        const row = dbRef.sqlite!.prepare('SELECT * FROM todos WHERE id = ?').get('todo-1') as any;
        expect(row.user_id).toBe(USER_1.id);
        expect(row.text).toBe('Buy milk');
        expect(row.done).toBe(0);
        expect(row.deleted).toBe(0);
    });

    it('stamps the todo row with an incremented version', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Task' } },
        ])));

        const row = dbRef.sqlite!.prepare('SELECT replicache_version FROM todos WHERE id = ?').get('todo-1') as any;
        const ver = dbRef.sqlite!.prepare('SELECT version FROM replicache_server_version').get() as any;
        expect(row.replicache_version).toBe(ver.version);
    });

    it('skips already-processed mutations (idempotency)', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'First' } },
        ])));
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-2', text: 'Duplicate' } },
        ])));

        const rows = dbRef.sqlite!.prepare('SELECT id FROM todos').all();
        expect(rows).toHaveLength(1);
    });

    it('records last_mutation_id for the client', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 5, name: 'createTodo', args: { id: 'todo-1', text: 'Task' } },
        ])));

        const client = dbRef.sqlite!
            .prepare('SELECT last_mutation_id FROM replicache_clients WHERE client_id = ?')
            .get(CLIENT_ID) as any;
        expect(client.last_mutation_id).toBe(5);
    });

    it('toggles a todo', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Task' } },
            { id: 2, name: 'toggleTodo', args: { id: 'todo-1' } },
        ])));

        const row = dbRef.sqlite!.prepare('SELECT done FROM todos WHERE id = ?').get('todo-1') as any;
        expect(row.done).toBe(1);
    });

    it('soft-deletes a todo', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Task' } },
            { id: 2, name: 'deleteTodo', args: { id: 'todo-1' } },
        ])));

        const row = dbRef.sqlite!.prepare('SELECT deleted FROM todos WHERE id = ?').get('todo-1') as any;
        expect(row.deleted).toBe(1);
    });

    it('does not let another user mutate a todo they do not own', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Private' } },
        ]), USER_1));

        await pushPOST(makeRequest(pushBody([
            { id: 2, name: 'toggleTodo', args: { id: 'todo-1' } },
        ]), USER_2));

        const row = dbRef.sqlite!.prepare('SELECT done FROM todos WHERE id = ?').get('todo-1') as any;
        expect(row.done).toBe(0);
    });

    it('still commits version + last_mutation_id when mutation name is unknown', async () => {
        const versionBefore = (dbRef.sqlite!.prepare('SELECT version FROM replicache_server_version').get() as any).version;

        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'nonExistentMutation', args: {} },
        ])));

        const versionAfter = (dbRef.sqlite!.prepare('SELECT version FROM replicache_server_version').get() as any).version;
        const client = dbRef.sqlite!.prepare('SELECT last_mutation_id FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;

        expect(versionAfter).toBeGreaterThan(versionBefore);
        expect(client.last_mutation_id).toBe(1);
    });
});

describe('pull', () => {
    it('returns all todos on first pull (cookie = null)', async () => {
        dbRef.sqlite!.prepare('INSERT INTO todos VALUES (?, ?, ?, 0, 0, 1)').run('todo-1', USER_1.id, 'Hello');

        const res = await pullPOST(makeRequest(pullBody(null)));
        const body = await res.json();

        expect(body.patch).toContainEqual({
            op: 'put', key: 'todo/todo-1', value: { id: 'todo-1', text: 'Hello', done: false },
        });
        expect(typeof body.cookie).toBe('number');
    });

    it('returns only rows changed since the last pull (delta sync)', async () => {
        dbRef.sqlite!.prepare('INSERT INTO todos VALUES (?, ?, ?, 0, 0, 1)').run('todo-old', USER_1.id, 'Old');
        dbRef.sqlite!.prepare('INSERT INTO todos VALUES (?, ?, ?, 0, 0, 2)').run('todo-new', USER_1.id, 'New');
        dbRef.sqlite!.prepare('UPDATE replicache_server_version SET version = 2').run();

        const res = await pullPOST(makeRequest(pullBody(1)));
        const body = await res.json();

        const keys = (body.patch as any[]).map((op: any) => op.key);
        expect(keys).toContain('todo/todo-new');
        expect(keys).not.toContain('todo/todo-old');
    });

    it('returns a del op for soft-deleted todos', async () => {
        dbRef.sqlite!.prepare('INSERT INTO todos VALUES (?, ?, ?, 0, 1, 2)').run('todo-1', USER_1.id, 'Gone');
        dbRef.sqlite!.prepare('UPDATE replicache_server_version SET version = 2').run();

        const res = await pullPOST(makeRequest(pullBody(1)));
        const body = await res.json();

        expect(body.patch).toContainEqual({ op: 'del', key: 'todo/todo-1' });
    });

    it("does not return another user's todos", async () => {
        dbRef.sqlite!.prepare('INSERT INTO todos VALUES (?, ?, ?, 0, 0, 1)').run('todo-1', USER_1.id, 'Mine');
        dbRef.sqlite!.prepare('INSERT INTO todos VALUES (?, ?, ?, 0, 0, 1)').run('todo-2', USER_2.id, 'Theirs');

        const res = await pullPOST(makeRequest(pullBody(null), USER_1));
        const body = await res.json();

        const keys = (body.patch as any[]).map((op: any) => op.key);
        expect(keys).toContain('todo/todo-1');
        expect(keys).not.toContain('todo/todo-2');
    });

    it('returns lastMutationIDChanges for the client group', async () => {
        dbRef.sqlite!.prepare(
            'INSERT INTO replicache_clients (client_id, client_group_id, last_mutation_id, confirmed_at_version) VALUES (?, ?, 7, 0)'
        ).run(CLIENT_ID, CLIENT_GROUP);

        const res = await pullPOST(makeRequest(pullBody(0)));
        const body = await res.json();

        expect(body.lastMutationIDChanges).toEqual({ [CLIENT_ID]: 7 });
    });

    it('does a full sync when cookie exceeds current version (legacy timestamp cookie)', async () => {
        dbRef.sqlite!.prepare('INSERT INTO todos VALUES (?, ?, ?, 0, 0, 1)').run('todo-1', USER_1.id, 'Hello');

        const res = await pullPOST(makeRequest(pullBody(9_999_999)));
        const body = await res.json();

        expect(body.patch).toContainEqual(
            expect.objectContaining({ op: 'put', key: 'todo/todo-1' })
        );
    });

    it('returns an empty patch when nothing changed', async () => {
        dbRef.sqlite!.prepare('UPDATE replicache_server_version SET version = 5').run();

        const res = await pullPOST(makeRequest(pullBody(5)));
        const body = await res.json();

        expect(body.patch).toHaveLength(0);
        expect(body.cookie).toBe(5);
    });
});

describe('push then pull', () => {
    it('created todo appears in pull', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Buy milk' } },
        ])));

        const res = await pullPOST(makeRequest(pullBody(null)));
        const body = await res.json();

        expect(body.patch).toContainEqual({
            op: 'put', key: 'todo/todo-1', value: { id: 'todo-1', text: 'Buy milk', done: false },
        });
    });

    it('toggled todo appears in delta pull', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Task' } },
        ])));

        const { cookie } = await pullPOST(makeRequest(pullBody(null))).then(r => r.json());

        await pushPOST(makeRequest(pushBody([
            { id: 2, name: 'toggleTodo', args: { id: 'todo-1' } },
        ])));

        const body = await pullPOST(makeRequest(pullBody(cookie))).then(r => r.json());

        expect(body.patch).toContainEqual({
            op: 'put', key: 'todo/todo-1', value: { id: 'todo-1', text: 'Task', done: true },
        });
    });

    it('deleted todo appears as del op in delta pull', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Temp' } },
        ])));

        const { cookie } = await pullPOST(makeRequest(pullBody(null))).then(r => r.json());

        await pushPOST(makeRequest(pushBody([
            { id: 2, name: 'deleteTodo', args: { id: 'todo-1' } },
        ])));

        const body = await pullPOST(makeRequest(pullBody(cookie))).then(r => r.json());

        expect(body.patch).toContainEqual({ op: 'del', key: 'todo/todo-1' });
    });

    it('pull confirms mutations in lastMutationIDChanges', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'A' } },
            { id: 2, name: 'createTodo', args: { id: 'todo-2', text: 'B' } },
        ])));

        const body = await pullPOST(makeRequest(pullBody(null))).then(r => r.json());

        expect(body.lastMutationIDChanges[CLIENT_ID]).toBe(2);
    });

    it('cookie advances after every push', async () => {
        const { cookie: c1 } = await pullPOST(makeRequest(pullBody(null))).then(r => r.json());

        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Task' } },
        ])));

        const { cookie: c2 } = await pullPOST(makeRequest(pullBody(c1))).then(r => r.json());

        expect(c2).toBeGreaterThan(c1);
    });

    it('second pull with same cookie returns empty lastMutationIDChanges (no "cookie did not change" warning)', async () => {
        await pushPOST(makeRequest(pushBody([
            { id: 1, name: 'createTodo', args: { id: 'todo-1', text: 'Task' } },
        ])));

        const { cookie } = await pullPOST(makeRequest(pullBody(null))).then(r => r.json());
        const body2 = await pullPOST(makeRequest(pullBody(cookie))).then(r => r.json());

        expect(body2.cookie).toBe(cookie);
        expect(Object.keys(body2.lastMutationIDChanges)).toHaveLength(0);
    });
});



