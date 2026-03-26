import { todoEntity } from 'features/todos';

/**
 * All entity tables that participate in Replicache sync.
 *
 * To add a new entity:
 *   1. Create a feature directory under packages/features/src/
 *   2. Export a SyncedEntity descriptor from it
 *   3. Append the entity here — pull, push, and commitMutation pick it up automatically
 */
export const syncedEntities = [todoEntity];
