import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';

const dbRef = vi.hoisted((): { sqlite: Database.Database | null } => ({ sqlite: null }));

vi.mock('@/db/database', async () => {
    const { default: SQLite } = await import('better-sqlite3');
    const { Kysely, SqliteDialect } = await import('kysely');
    const { buildSqliteCommit } = await import('replicache-sync');

    const sqlite = new SQLite(':memory:');
    sqlite.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE todos (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            deleted INTEGER NOT NULL DEFAULT 0,
            replicache_version INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE replicache_clients (
            client_id TEXT PRIMARY KEY,
            client_group_id TEXT NOT NULL DEFAULT '',
            last_mutation_id INTEGER NOT NULL DEFAULT 0,
            confirmed_at_version INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE replicache_server_version (
            id INTEGER PRIMARY KEY DEFAULT 1,
            version INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO replicache_server_version (id, version) VALUES (1, 1);
    `);

    dbRef.sqlite = sqlite;

    const db = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    const commitMutation = buildSqliteCommit(sqlite, ['todos']);
    return { db, commitMutation };
});

import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { GET as sessionGET } from '@/app/api/auth/session/route';
import { POST as pushPOST } from '@/app/api/replicache/push/route';
import { POST as pullPOST } from '@/app/api/replicache/pull/route';
import { getAuthCookieName, signJwt } from '@/auth/jwt';

function makeRequest(method: string, body?: unknown, cookie?: string) {
    return new Request('http://localhost', {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

const credentials = {
    email: 'user@example.com',
    password: 'password123',
};

beforeEach(() => {
    dbRef.sqlite!.exec(`
        DELETE FROM users;
        DELETE FROM todos;
        DELETE FROM replicache_clients;
        UPDATE replicache_server_version SET version = 1;
    `);
});

describe('auth routes', () => {
    it('registers a user and sets an auth cookie', async () => {
        const response = await registerPOST(makeRequest('POST', credentials));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.user.email).toBe(credentials.email);
        expect(response.headers.get('set-cookie')).toContain(`${getAuthCookieName()}=`);
    });

    it('logs in an existing user', async () => {
        await registerPOST(makeRequest('POST', credentials));

        const response = await loginPOST(makeRequest('POST', credentials));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.user.email).toBe(credentials.email);
    });

    it('returns the active session for a valid token', async () => {
        const registerResponse = await registerPOST(makeRequest('POST', credentials));
        const registerBody = await registerResponse.json();
        const cookie = `${getAuthCookieName()}=${signJwt(registerBody.user)}`;

        const response = await sessionGET(makeRequest('GET', undefined, cookie));
        const body = await response.json();

        expect(body.user.email).toBe(credentials.email);
    });

    it('clears the cookie on logout', async () => {
        const response = await logoutPOST();

        expect(response.status).toBe(200);
        expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    });
});

describe('protected replicache routes', () => {
    it('rejects unauthenticated push requests', async () => {
        const response = await pushPOST(makeRequest('POST', {
            profileID: 'profile-1',
            clientGroupID: 'group-1',
            pushVersion: 1,
            mutations: [],
        }));

        expect(response.status).toBe(401);
    });

    it('rejects unauthenticated pull requests', async () => {
        const response = await pullPOST(makeRequest('POST', {
            profileID: 'profile-1',
            clientGroupID: 'group-1',
            cookie: null,
            pullVersion: 1,
        }));

        expect(response.status).toBe(401);
    });
});
