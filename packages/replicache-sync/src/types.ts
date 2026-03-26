/**
 * Minimum shape every synced DB row must satisfy.
 * Entity-specific columns are captured by the TRow generic parameter.
 */
export interface SyncRow {
    id: string;
    deleted: number;           // 0 | 1 soft-delete flag
    replicache_version: number; // server version at last modification
    [column: string]: unknown;
}

/**
 * Describes one entity table that participates in Replicache sync.
 * Register every synced table in an array and pass it to buildPullResponse.
 */
export interface SyncedEntity<
    TRow extends SyncRow,
    TValue,
> {
    /** DB table name, e.g. "todos". */
    readonly tableName: string;
    /** Replicache key prefix, e.g. "todo" → key becomes "todo/<id>". */
    readonly keyPrefix: string;
    /** Maps a raw DB row to the value stored in the Replicache client cache. */
    toValue(row: TRow): TValue;
}

/** Identifies the entity row touched by a single mutation. */
export interface AffectedRow {
    tableName: string;
    id: string;
}

export interface CommitMutationParams {
    clientID: string;
    clientGroupID: string;
    mutationId: number;
    /** The row written by this mutation, or null when nothing was affected
     *  (unknown mutation name) — the version increment still happens. */
    affectedRow: AffectedRow | null;
}

/**
 * Atomically increments the server version, stamps the affected row, and
 * upserts the client record. Must be synchronous to prevent pull handlers
 * from observing partial state on a shared DB connection.
 */
export type CommitFn = (params: CommitMutationParams) => void;
