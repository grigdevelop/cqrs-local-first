import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PushRequestV1 } from 'replicache';
import { processPush } from '../push';
import { createTestDb } from './helpers';

const CLIENT_GROUP = 'group-1';
const CLIENT_ID = 'client-1';

function makePush(
    mutations: { clientID?: string; id: number; name: string; args: unknown }[]
): PushRequestV1 {
    return {
        profileID: 'p1',
        clientGroupID: CLIENT_GROUP,
        pushVersion: 1,
        schemaVersion: '',
        mutations: mutations.map(({ clientID = CLIENT_ID, ...rest }) => ({
            clientID,
            timestamp: Date.now(),
            ...rest,
        })) as PushRequestV1['mutations'],
    };
}

describe('processPush', () => {
    let ctx: ReturnType<typeof createTestDb>;
    let executeMutation: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        ctx = createTestDb();
        executeMutation = vi.fn().mockImplementation(async (name: string, args: unknown) => {
            const { id, value } = args as { id: string; value?: string };
            if (name === 'createItem') {
                ctx.sqlite.prepare('INSERT INTO items (id, value) VALUES (?, ?)').run(id, value ?? '');
            } else if (name === 'deleteItem') {
                ctx.sqlite.prepare('UPDATE items SET deleted = 1 WHERE id = ?').run(id);
            }
        });
    });

    function getMutationEntityTable(name: string) {
        const map: Record<string, string> = { createItem: 'items', deleteItem: 'items' };
        return map[name] ?? null;
    }

    it('executes the mutation and commits', async () => {
        const { db, commit, sqlite } = ctx;

        await processPush(db, makePush([{ id: 1, name: 'createItem', args: { id: 'item-1', value: 'hello' } }]), {
            executeMutation,
            getMutationEntityTable,
            commit,
        });

        const row = sqlite.prepare('SELECT * FROM items WHERE id = ?').get('item-1') as any;
        expect(row).toBeDefined();
        expect(row.value).toBe('hello');
    });

    it('stamps replicache_version on the affected row', async () => {
        const { db, commit, sqlite } = ctx;

        await processPush(db, makePush([{ id: 1, name: 'createItem', args: { id: 'item-1', value: 'x' } }]), {
            executeMutation,
            getMutationEntityTable,
            commit,
        });

        const row = sqlite.prepare('SELECT replicache_version FROM items WHERE id = ?').get('item-1') as any;
        const ver = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;
        expect(row.replicache_version).toBe(ver);
    });

    it('records last_mutation_id for the client', async () => {
        const { db, commit, sqlite } = ctx;

        await processPush(db, makePush([{ id: 5, name: 'createItem', args: { id: 'item-1', value: 'x' } }]), {
            executeMutation,
            getMutationEntityTable,
            commit,
        });

        const client = sqlite.prepare('SELECT last_mutation_id FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;
        expect(client.last_mutation_id).toBe(5);
    });

    it('skips already-processed mutations (idempotency)', async () => {
        const { db, commit } = ctx;

        await processPush(db, makePush([{ id: 1, name: 'createItem', args: { id: 'item-1', value: 'first' } }]), {
            executeMutation, getMutationEntityTable, commit,
        });
        await processPush(db, makePush([{ id: 1, name: 'createItem', args: { id: 'item-2', value: 'duplicate' } }]), {
            executeMutation, getMutationEntityTable, commit,
        });

        const rows = ctx.sqlite.prepare('SELECT id FROM items').all();
        expect(rows).toHaveLength(1);
        expect(executeMutation).toHaveBeenCalledTimes(1);
    });

    it('commits version + last_mutation_id even when mutation name is unknown', async () => {
        const { db, commit, sqlite } = ctx;
        const versionBefore = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;

        await processPush(db, makePush([{ id: 1, name: 'unknownMutation', args: {} }]), {
            executeMutation,
            getMutationEntityTable: () => null,
            commit,
        });

        const versionAfter = (sqlite.prepare('SELECT version FROM replicache_server_version').get() as any).version;
        const client = sqlite.prepare('SELECT last_mutation_id FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;

        expect(versionAfter).toBeGreaterThan(versionBefore);
        expect(client.last_mutation_id).toBe(1);
    });

    it('continues processing remaining mutations when one fails', async () => {
        const { db, commit, sqlite } = ctx;
        const errorMutation = vi.fn().mockImplementation(async (name: string, args: unknown) => {
            if (name === 'failingMutation') throw new Error('intentional failure');
            return executeMutation(name, args);
        });

        await processPush(db, makePush([
            { id: 1, name: 'failingMutation', args: { id: 'x' } },
            { id: 2, name: 'createItem', args: { id: 'item-1', value: 'ok' } },
        ]), {
            executeMutation: errorMutation,
            getMutationEntityTable,
            commit,
        });

        const row = sqlite.prepare('SELECT * FROM items WHERE id = ?').get('item-1') as any;
        expect(row).toBeDefined();

        const client = sqlite.prepare('SELECT last_mutation_id FROM replicache_clients WHERE client_id = ?').get(CLIENT_ID) as any;
        expect(client.last_mutation_id).toBe(2);
    });

    it('handles multiple mutations in one push', async () => {
        const { db, commit, sqlite } = ctx;

        await processPush(db, makePush([
            { id: 1, name: 'createItem', args: { id: 'item-1', value: 'a' } },
            { id: 2, name: 'createItem', args: { id: 'item-2', value: 'b' } },
            { id: 3, name: 'deleteItem', args: { id: 'item-1' } },
        ]), {
            executeMutation, getMutationEntityTable, commit,
        });

        const rows = sqlite.prepare('SELECT id, deleted FROM items').all() as any[];
        expect(rows).toHaveLength(2);
        const item1 = rows.find(r => r.id === 'item-1');
        const item2 = rows.find(r => r.id === 'item-2');
        expect(item1!.deleted).toBe(1);
        expect(item2!.deleted).toBe(0);
    });

    it('does not stamp the row when getMutationEntityTable returns null', async () => {
        const { db, commit, sqlite } = ctx;
        sqlite.prepare('INSERT INTO items (id, value, replicache_version) VALUES (?, ?, 0)').run('item-1', 'x');

        await processPush(db, makePush([{ id: 1, name: 'crossCuttingMutation', args: { id: 'item-1' } }]), {
            executeMutation,
            getMutationEntityTable: () => null,
            commit,
        });

        const row = sqlite.prepare('SELECT replicache_version FROM items WHERE id = ?').get('item-1') as any;
        expect(row.replicache_version).toBe(0);
    });
});
