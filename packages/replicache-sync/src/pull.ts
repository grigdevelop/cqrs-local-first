import type { Kysely, RawBuilder } from 'kysely';
import { sql } from 'kysely';
import type { PullRequestV1, PullResponseOKV1, PatchOperation } from 'replicache';
import type { SyncedEntity, SyncRow } from './types';

interface ReplicacheClientRow {
    client_id: string;
    last_mutation_id: number;
    confirmed_at_version: number;
}

interface BuildPullResponseOptions {
    rowFilter?: (tableName: string) => RawBuilder<unknown> | undefined;
}

export async function buildPullResponse(
    db: Kysely<any>,
    entities: SyncedEntity<any, any>[],
    pull: PullRequestV1,
    options: BuildPullResponseOptions = {},
): Promise<PullResponseOKV1> {
    const { version: currentVersion } = await db
        .selectFrom('replicache_server_version')
        .select('version')
        .where('id', '=', 1)
        .executeTakeFirstOrThrow();

    const rawCookie = pull.cookie as number | null;
    const fromVersion = rawCookie != null && rawCookie <= currentVersion ? rawCookie : 0;

    const clients = await db
        .selectFrom('replicache_clients')
        .selectAll()
        .where('client_group_id', '=', pull.clientGroupID)
        .$if(fromVersion > 0, qb => qb.where('confirmed_at_version', '>', fromVersion))
        .execute() as ReplicacheClientRow[];

    let patch: PatchOperation[];

    if (fromVersion === 0) {
        const entityPatches = await Promise.all(
            entities.map(async entity => {
                const rowFilter = options.rowFilter?.(entity.tableName) ?? sql`1 = 1`;
                const { rows } = await db.executeQuery<SyncRow>(
                    sql`SELECT * FROM ${sql.table(entity.tableName)} WHERE deleted = 0 AND ${rowFilter}`.compile(db)
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
        const entityPatches = await Promise.all(
            entities.map(async entity => {
                const rowFilter = options.rowFilter?.(entity.tableName) ?? sql`1 = 1`;
                const { rows } = await db.executeQuery<SyncRow>(
                    sql`SELECT * FROM ${sql.table(entity.tableName)} WHERE replicache_version > ${fromVersion} AND ${rowFilter}`.compile(db)
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
