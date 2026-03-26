import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers';

const CLIENT_ID = 'client-1';
const CLIENT_GROUP = 'group-1';

describe('buildSqliteCommit', () => {
    let ctx: ReturnType<typeof createTestDb>;

    beforeEach(() => {
        ctx = createTestDb();
    });

    it('increments the server version', () => {
        const { sqlite, commit } = ctx;
        const before = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;

        commit({ clientID: CLIENT_ID, clientGroupID: CLIENT_GROUP, mutationId: 1, affectedRow: null });

        const after = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;
        expect(after).toBe(before + 1);
    });

    it('stamps replicache_version on the affected row', () => {
        const { sqlite, commit } = ctx;
        sqlite.prepare('INSERT INTO items (id, value) VALUES (?, ?)').run('item-1', 'hello');

        commit({ clientID: CLIENT_ID, clientGroupID: CLIENT_GROUP, mutationId: 1, affectedRow: { tableName: 'items', id: 'item-1' } });

        const row = sqlite.prepare('SELECT replicache_version FROM items WHERE id = ?').get('item-1') as any;
        const ver = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;
        expect(row.replicache_version).toBe(ver);
    });

    it('does not stamp when affectedRow is null', () => {
        const { sqlite, commit } = ctx;
        sqlite.prepare('INSERT INTO items (id, value, replicache_version) VALUES (?, ?, ?)').run('item-1', 'hello', 0);

        commit({ clientID: CLIENT_ID, clientGroupID: CLIENT_GROUP, mutationId: 1, affectedRow: null });

        const row = sqlite.prepare('SELECT replicache_version FROM items WHERE id = ?').get('item-1') as any;
        expect(row.replicache_version).toBe(0);
    });

    it('upserts the client with last_mutation_id and confirmed_at_version', () => {
        const { sqlite, commit } = ctx;

        commit({ clientID: CLIENT_ID, clientGroupID: CLIENT_GROUP, mutationId: 7, affectedRow: null });

        const client = sqlite.prepare('SELECT * FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;
        expect(client.last_mutation_id).toBe(7);
        expect(client.client_group_id).toBe(CLIENT_GROUP);

        const ver = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;
        expect(client.confirmed_at_version).toBe(ver);
    });

    it('updates an existing client record on subsequent commits', () => {
        const { sqlite, commit } = ctx;

        commit({ clientID: CLIENT_ID, clientGroupID: CLIENT_GROUP, mutationId: 1, affectedRow: null });
        commit({ clientID: CLIENT_ID, clientGroupID: CLIENT_GROUP, mutationId: 2, affectedRow: null });

        const client = sqlite.prepare('SELECT last_mutation_id FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;
        expect(client.last_mutation_id).toBe(2);

        const clients = sqlite.prepare('SELECT COUNT(*) as cnt FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;
        expect(clients.cnt).toBe(1);
    });

    it('runs as a single atomic transaction (version == confirmed_at_version)', () => {
        const { sqlite, commit } = ctx;
        sqlite.prepare('INSERT INTO items (id, value) VALUES (?, ?)').run('item-1', 'x');

        commit({ clientID: CLIENT_ID, clientGroupID: CLIENT_GROUP, mutationId: 1, affectedRow: { tableName: 'items', id: 'item-1' } });

        const ver = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;
        const client = sqlite.prepare('SELECT confirmed_at_version FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;
        const row = sqlite.prepare('SELECT replicache_version FROM items WHERE id = ?').get('item-1') as any;

        // All three writes use the same version number.
        expect(client.confirmed_at_version).toBe(ver);
        expect(row.replicache_version).toBe(ver);
    });
});
