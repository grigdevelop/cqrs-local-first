import type { ArticleTable } from 'features/articles';
import type { TodoTable } from 'features/todos';

export type { ArticleTable } from 'features/articles';
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
    confirmed_at_version: number;
}

export interface ReplicacheServerVersionTable {
    id: number;
    version: number;
}

export interface AppDatabase {
    articles: ArticleTable;
    todos: TodoTable;
    users: UserTable;
    replicache_clients: ReplicacheClientTable;
    replicache_server_version: ReplicacheServerVersionTable;
}
