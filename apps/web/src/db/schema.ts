import type { TodoTable } from 'features/todos';

export type { TodoTable } from 'features/todos';

export interface UserTable {
    id: string;
    email: string;
    password_hash: string;
    created_at: string;
}

export interface ReplicacheClientTable {
    client_id: string;
    client_group_id: string;
    last_mutation_id: number;
    // Server version at which last_mutation_id was last updated.
    confirmed_at_version: number;
}

export interface ReplicacheServerVersionTable {
    id: number;   // always 1
    version: number;
}

export interface AppDatabase {
    todos: TodoTable;
    users: UserTable;
    replicache_clients: ReplicacheClientTable;
    replicache_server_version: ReplicacheServerVersionTable;
}
