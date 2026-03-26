import type { Kysely } from 'kysely';
import type { PushRequestV1 } from 'replicache';
import type { CommitFn, AffectedRow } from './types';

export interface PushOptions {
    /**
     * Execute the business-logic mutation (insert/update/delete in the DB).
     * Errors are caught and logged; the commit still happens so version and
     * last_mutation_id stay consistent.
     */
    executeMutation(name: string, args: unknown): Promise<unknown>;

    /**
     * Return the entity table name this mutation writes to, or null/undefined
     * for cross-cutting mutations that don't stamp a single row.
     * Convention: args.id is used as the affected row id.
     */
    getMutationEntityTable(name: string): string | null | undefined;

    /**
     * Atomically increment the server version, stamp the affected row, and
     * upsert the client's last_mutation_id + confirmed_at_version.
     */
    commit: CommitFn;
}

/**
 * Processes a Replicache push request against any Kysely-backed database.
 *
 * For each mutation:
 *   1. Skip if already applied (at-least-once delivery guarantee).
 *   2. Run executeMutation (business logic).
 *   3. Atomically commit version, row stamp, and client record via commit().
 *
 * @param db      A Kysely instance used to read client state.
 * @param push    The parsed PushRequestV1 from the client.
 * @param options Application-supplied callbacks and the commit function.
 */
export async function processPush(
    db: Kysely<any>,
    push: PushRequestV1,
    options: PushOptions,
): Promise<void> {
    const { executeMutation, getMutationEntityTable, commit } = options;

    for (const mutation of push.mutations) {
        const { clientID, id, name, args } = mutation;

        const client = await db
            .selectFrom('replicache_clients')
            .select('last_mutation_id')
            .where('client_id', '=', clientID)
            .executeTakeFirst();

        // Skip mutations the server has already applied.
        if (id <= (client?.last_mutation_id ?? 0)) continue;

        try {
            await executeMutation(name, args);
        } catch (e) {
            console.error(`Mutation "${name}" failed:`, e);
        }

        const tableName = getMutationEntityTable(name);
        const rowId =
            typeof (args as Record<string, unknown>)?.id === 'string'
                ? ((args as Record<string, unknown>).id as string)
                : null;

        const affectedRow: AffectedRow | null =
            tableName != null && rowId != null ? { tableName, id: rowId } : null;

        commit({ clientID, clientGroupID: push.clientGroupID, mutationId: id, affectedRow });
    }
}
