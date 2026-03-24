// Shared in-memory state for Replicache server handlers.
// In production replace with a database-backed store.
export const clientMutationIDs = new Map<string, number>();
