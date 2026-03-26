import { describe, it, expect, beforeEach } from 'vitest';
import type { PullRequestV1 } from 'replicache';
import { buildPullResponse } from '../pull';
import { createTestDb, itemsEntity } from './helpers';

const CLIENT_GROUP = 'group-1';
const CLIENT_ID = 'client-1';

function makePull(cookie: number | null): PullRequestV1 {
    return { profileID: 'p1', clientGroupID: CLIENT_GROUP, cookie, pullVersion: 1, schemaVersion: '' };
}

describe('buildPullResponse', () => {
    let ctx: ReturnType<typeof createTestDb>;

    beforeEach(() => {
        ctx = createTestDb();
    });

    it('returns a clear op + all non-deleted rows on first pull (cookie = null)', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare('INSERT INTO items (id, value, replicache_version) VALUES (?, ?, 1)').run('item-1', 'hello');

        const res = await buildPullResponse(db, [itemsEntity], makePull(null));

        expect(res.patch[0]).toEqual({ op: 'clear' });
        expect(res.patch).toContainEqual({
            op: 'put',
            key: 'item/item-1',
            value: { id: 'item-1', value: 'hello' },
        });
    });

    it('excludes deleted rows from full sync', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare('INSERT INTO items (id, value, deleted, replicache_version) VALUES (?, ?, 1, 1)').run('item-gone', 'x');

        const res = await buildPullResponse(db, [itemsEntity], makePull(null));

        const keys = res.patch.map((op: any) => op.key).filter(Boolean);
        expect(keys).not.toContain('item/item-gone');
    });

    it('returns only rows changed since last pull (delta sync)', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare('INSERT INTO items (id, value, replicache_version) VALUES (?, ?, 1)').run('item-old', 'old');
        sqlite.prepare('INSERT INTO items (id, value, replicache_version) VALUES (?, ?, 2)').run('item-new', 'new');
        sqlite.prepare('UPDATE replicache_server_version SET version = 2').run();

        const res = await buildPullResponse(db, [itemsEntity], makePull(1));

        const keys = res.patch.map((op: any) => op.key);
        expect(keys).toContain('item/item-new');
        expect(keys).not.toContain('item/item-old');
    });

    it('returns a del op for soft-deleted rows in delta sync', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare('INSERT INTO items (id, value, deleted, replicache_version) VALUES (?, ?, 1, 2)').run('item-1', 'gone');
        sqlite.prepare('UPDATE replicache_server_version SET version = 2').run();

        const res = await buildPullResponse(db, [itemsEntity], makePull(1));

        expect(res.patch).toContainEqual({ op: 'del', key: 'item/item-1' });
    });

    it('returns lastMutationIDChanges for the client group', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare(
            'INSERT INTO replicache_clients (client_id, client_group_id, last_mutation_id, confirmed_at_version) VALUES (?, ?, 5, 0)'
        ).run(CLIENT_ID, CLIENT_GROUP);

        const res = await buildPullResponse(db, [itemsEntity], makePull(null));

        expect(res.lastMutationIDChanges).toEqual({ [CLIENT_ID]: 5 });
    });

    it('omits clients whose confirmation is already known to the client (delta pull)', async () => {
        const { sqlite, db } = ctx;
        // Client confirmed at version 1; client already has cookie 1.
        sqlite.prepare(
            'INSERT INTO replicache_clients (client_id, client_group_id, last_mutation_id, confirmed_at_version) VALUES (?, ?, 3, 1)'
        ).run(CLIENT_ID, CLIENT_GROUP);
        sqlite.prepare('UPDATE replicache_server_version SET version = 1').run();

        const res = await buildPullResponse(db, [itemsEntity], makePull(1));

        // confirmed_at_version (1) is NOT > fromVersion (1), so omitted.
        expect(Object.keys(res.lastMutationIDChanges)).toHaveLength(0);
    });

    it('falls back to full sync when cookie exceeds current version (stale timestamp)', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare('INSERT INTO items (id, value, replicache_version) VALUES (?, ?, 1)').run('item-1', 'hi');

        const res = await buildPullResponse(db, [itemsEntity], makePull(9_999_999));

        expect(res.patch[0]).toEqual({ op: 'clear' });
        expect(res.patch).toContainEqual(expect.objectContaining({ op: 'put', key: 'item/item-1' }));
    });

    it('returns empty patch and correct cookie when nothing changed', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare('UPDATE replicache_server_version SET version = 5').run();

        const res = await buildPullResponse(db, [itemsEntity], makePull(5));

        expect(res.patch).toHaveLength(0);
        expect(res.cookie).toBe(5);
    });

    it('sets cookie to the current server version', async () => {
        const { sqlite, db } = ctx;
        sqlite.prepare('UPDATE replicache_server_version SET version = 42').run();

        const res = await buildPullResponse(db, [itemsEntity], makePull(null));

        expect(res.cookie).toBe(42);
    });

    it('supports multiple entity types in one pull', async () => {
        // Second entity: "widgets" table
        const { sqlite, db } = ctx;
        sqlite.exec(`
            CREATE TABLE widgets (
                id                 TEXT PRIMARY KEY,
                label              TEXT NOT NULL,
                deleted            INTEGER NOT NULL DEFAULT 0,
                replicache_version INTEGER NOT NULL DEFAULT 0
            );
        `);
        const widgetsEntity = {
            tableName: 'widgets',
            keyPrefix: 'widget',
            toValue: (row: any) => ({ id: row.id, label: row.label }),
        };

        sqlite.prepare('INSERT INTO items (id, value, replicache_version) VALUES (?, ?, 1)').run('item-1', 'hi');
        sqlite.prepare('INSERT INTO widgets (id, label, replicache_version) VALUES (?, ?, 1)').run('w-1', 'gear');

        const res = await buildPullResponse(db, [itemsEntity, widgetsEntity], makePull(null));

        const keys = res.patch.map((op: any) => op.key).filter(Boolean);
        expect(keys).toContain('item/item-1');
        expect(keys).toContain('widget/w-1');
    });
});
