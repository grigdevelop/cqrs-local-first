import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { PullRequestV1, PullResponseOKV1, PatchOperation } from 'replicache';
import type { SyncedEntity, SyncRow } from './types';

interface ReplicacheClientRow {
    client_id: string;
    last_mutation_id: number;
    confirmed_at_version: number;
}

/**
 * Builds a Replicache pull response from any Kysely-backed database.
 *
 * Performs a full sync (cookie = null or stale) or a delta sync (cookie ≤ currentVersion).
 * The database must have the standard Replicache infrastructure tables:
 *   - replicache_server_version (id, version)
 *   - replicache_clients (client_id, client_group_id, last_mutation_id, confirmed_at_version)
 *
 * Each entity table must have columns: id, deleted, replicache_version.
 *
 * @param db       A Kysely instance connected to the target database.
 * @param entities Registry of synced entity tables.
 * @param pull     The parsed PullRequestV1 from the client.
 */
export async function buildPullResponse(
    db: Kysely<any>,
    entities: SyncedEntity<any, any>[],
    pull: PullRequestV1,
): Promise<PullResponseOKV1> {
    const { version: currentVersion } = await db
        .selectFrom('replicache_server_version')
        .select('version')
        .where('id', '=', 1)
        .executeTakeFirstOrThrow();

    // null → first pull (full sync).
    // cookie > currentVersion → stale timestamp cookie → fall back to full sync.
    const rawCookie = pull.cookie as number | null;
    const fromVersion = rawCookie != null && rawCookie <= currentVersion ? rawCookie : 0;

    // Only include clients confirmed after fromVersion to avoid the
    // "cookie did not change, but lastMutationIDChanges is not empty" warning.
    const clients: ReplicacheClientRow[] = await db
        .selectFrom('replicache_clients')
        .selectAll()
        .where('client_group_id', '=', pull.clientGroupID)
        .$if(fromVersion > 0, qb => qb.where('confirmed_at_version', '>', fromVersion))
        .execute();

    let patch: PatchOperation[];

    if (fromVersion === 0) {
        // Full sync: clear client cache then re-populate every non-deleted entity.
        const entityPatches = await Promise.all(
            entities.map(async entity => {
                const { rows } = await db.executeQuery<SyncRow>(
                    sql`SELECT * FROM ${sql.table(entity.tableName)} WHERE deleted = 0`.compile(db)
                );
                return rows.map((row): PatchOperation => ({
                    op: 'put',
                    key: `${entity.keyPrefix}/${row.id}`,
                    value: entity.toValue(row),
                }));
            })
        );
        patch = [{ op: 'clear' }, ...entityPatches.flat()];
    } else {
        // Delta sync: only rows modified since the client's last pull.
        const entityPatches = await Promise.all(
            entities.map(async entity => {
                const { rows } = await db.executeQuery<SyncRow>(
                    sql`SELECT * FROM ${sql.table(entity.tableName)} WHERE replicache_version > ${fromVersion}`.compile(db)
                );
                return rows.map((row): PatchOperation =>
                    row.deleted
                        ? { op: 'del', key: `${entity.keyPrefix}/${row.id}` }
                        : { op: 'put', key: `${entity.keyPrefix}/${row.id}`, value: entity.toValue(row) }
                );
            })
        );
        patch = entityPatches.flat();
    }

    const lastMutationIDChanges: Record<string, number> = Object.fromEntries(
        clients.map(c => [c.client_id, c.last_mutation_id])
    );

    return { cookie: currentVersion, lastMutationIDChanges, patch };
}
