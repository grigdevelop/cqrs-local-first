import { describe, expect, it } from 'vitest';

import { z } from 'zod';
import SQLite from 'better-sqlite3';
import { ColumnType, Kysely, SqliteDialect } from 'kysely';
import { buildPullResponse } from '../pull';
import { processPush } from '../push';
import { buildSqliteCommit } from '../sqlite-commit';
import type { CommitFn } from '../types';

type EntityBase = {
    id: string;
    deleted: number;
    replicache_version: number;
};

type EntityMetadata<TName extends string, TEntity, TValue = TEntity> = {
    name: TName;
    keyPrefix: string;
    schema: z.ZodType<TEntity>;
    toValue: (row: TEntity) => TValue;
};

function createEntity<TName extends string, TEntity extends EntityBase, TValue = TEntity>(
    name: TName,
    schema: z.ZodType<TEntity>,
    options?: { keyPrefix?: string; toValue?: (row: TEntity) => TValue }
): EntityMetadata<TName, TEntity, TValue> {
    return {
        name,
        keyPrefix: options?.keyPrefix ?? name,
        schema,
        toValue: (options?.toValue ?? ((row) => row)) as (row: TEntity) => TValue,
    };
}

// get kysely table type from entity metadata
type KyselyTableFromEntity<TEntity extends EntityBase> = {
    [K in keyof TEntity]: K extends 'id'
    ? ColumnType<TEntity[K], TEntity[K], never>
    : K extends 'deleted' | 'replicache_version'
    ? ColumnType<TEntity[K], TEntity[K] | undefined, TEntity[K]>
    : ColumnType<TEntity[K], TEntity[K] | undefined, TEntity[K] | undefined>;
};

type ExtractEntityType<T> = T extends EntityMetadata<string, infer E, any> ? E : never;

type EntityToKyselyTable<T extends EntityMetadata<string, any, any>> = KyselyTableFromEntity<ExtractEntityType<T>>;

type DatabaseFromEntities<TEntities extends readonly EntityMetadata<string, any, any>[]> = {
    [K in TEntities[number] as K['name']]: EntityToKyselyTable<K>;
};

type DatabaseMetadata<TEntities extends readonly EntityMetadata<string, any, any>[]> = {
    entities: TEntities;
};

type InferDatabase<T> = T extends DatabaseMetadata<infer TEntities>
    ? DatabaseFromEntities<TEntities>
    : never;

function createDatabase<TEntities extends readonly EntityMetadata<string, any, any>[]>(options: {
    entities: TEntities;
}): DatabaseMetadata<TEntities> {
    return { entities: options.entities };
}

type MutationDef<TEntities extends readonly EntityMetadata<string, any, any>[]> = {
    entity: TEntities[number] | null;
    handler: (db: Kysely<DatabaseFromEntities<TEntities>>, args: unknown) => Promise<void>;
};

type MutationsMetadata<TEntities extends readonly EntityMetadata<string, any, any>[]> = {
    dbMeta: DatabaseMetadata<TEntities>;
    mutations: Record<string, MutationDef<TEntities>>;
};

function createMutations<TEntities extends readonly EntityMetadata<string, any, any>[]>(
    dbMeta: DatabaseMetadata<TEntities>,
    mutations: Record<string, MutationDef<TEntities>>
): MutationsMetadata<TEntities> {
    return { dbMeta, mutations };
}

function toPullEntities(dbMeta: DatabaseMetadata<readonly EntityMetadata<string, any, any>[]>) {
    return dbMeta.entities.map(e => ({
        tableName: e.name,
        keyPrefix: e.keyPrefix,
        toValue: e.toValue,
    }));
}

function toPushOptions(
    mutationsMeta: MutationsMetadata<readonly EntityMetadata<string, any, any>[]>,
    db: Kysely<any>,
    commit: CommitFn,
) {
    return {
        async executeMutation(name: string, args: unknown) {
            const mutation = mutationsMeta.mutations[name];
            if (!mutation) throw new Error(`Unknown mutation: ${name}`);
            await mutation.handler(db, args);
        },
        getMutationEntityTable(name: string) {
            return mutationsMeta.mutations[name]?.entity?.name ?? null;
        },
        commit,
    };
}

describe('entities', () => {
    it('should work', () => {
        const userEntity = createEntity('user', z.object({
            id: z.string(),
            deleted: z.number(),
            replicache_version: z.number(),
            name: z.string(),
            description: z.string().optional(),
        }));

        type UserTable = EntityToKyselyTable<typeof userEntity>;

        expect(userEntity).toBeDefined();
    });

    it('should create database metadata from entities and allow Kysely type extraction', () => {
        const userEntity = createEntity('users', z.object({
            id: z.string(),
            deleted: z.number(),
            replicache_version: z.number(),
            name: z.string(),
        }));

        const postEntity = createEntity('posts', z.object({
            id: z.string(),
            deleted: z.number(),
            replicache_version: z.number(),
            title: z.string(),
            content: z.string(),
        }));

        const dbMeta = createDatabase({
            entities: [userEntity, postEntity] as const,
        });

        type DB = InferDatabase<typeof dbMeta>;
        type ExpectedDB = {
            users: EntityToKyselyTable<typeof userEntity>;
            posts: EntityToKyselyTable<typeof postEntity>;
        };

        // Type check: DB should be assignable to ExpectedDB
        const _typeCheck: ExpectedDB = {} as DB;

        expect(dbMeta.entities).toHaveLength(2);
        expect(dbMeta.entities[0]).toBe(userEntity);
        expect(dbMeta.entities[1]).toBe(postEntity);
    });

    it('should instantiate a typed Kysely instance from database metadata using SQLite in-memory dialect', async () => {
        const userEntity = createEntity('users', z.object({
            id: z.string(),
            deleted: z.number(),
            replicache_version: z.number(),
            name: z.string(),
        }));

        const postEntity = createEntity('posts', z.object({
            id: z.string(),
            deleted: z.number(),
            replicache_version: z.number(),
            title: z.string(),
            content: z.string(),
        }));

        const dbMeta = createDatabase({
            entities: [userEntity, postEntity] as const,
        });

        type DB = InferDatabase<typeof dbMeta>;

        const sqlite = new SQLite(':memory:');
        sqlite.exec(`
            CREATE TABLE users (
                id                 TEXT    PRIMARY KEY,
                name               TEXT    NOT NULL,
                deleted            INTEGER NOT NULL DEFAULT 0,
                replicache_version INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE posts (
                id                 TEXT    PRIMARY KEY,
                title              TEXT    NOT NULL,
                content            TEXT    NOT NULL,
                deleted            INTEGER NOT NULL DEFAULT 0,
                replicache_version INTEGER NOT NULL DEFAULT 0
            );
        `);

        const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });

        await db.insertInto('users').values({ id: 'u1', name: 'Alice' }).execute();
        await db.insertInto('posts').values({ id: 'p1', title: 'Post 1', content: 'Content 1' }).execute();

        const row = await db.selectFrom('users').selectAll().where('id', '=', 'u1').executeTakeFirstOrThrow();

        expect(row.id).toBe('u1');
        expect(row.name).toBe('Alice');
        expect(row.deleted).toBe(0);
        expect(row.replicache_version).toBe(0);

        await db.destroy();
    });

    it('should drive pull and push from database metadata', async () => {
        const userEntity = createEntity('users', z.object({
            id: z.string(),
            deleted: z.number(),
            replicache_version: z.number(),
            name: z.string(),
        }), { keyPrefix: 'user' });

        const dbMeta = createDatabase({
            entities: [userEntity] as const,
        });

        const mutations = createMutations(dbMeta, {
            createUser: {
                entity: userEntity,
                handler: async (db, args) => {
                    const { id, name } = args as { id: string; name: string };
                    await db.insertInto('users').values({ id, name }).execute();
                },
            },
        });

        type DB = InferDatabase<typeof dbMeta>;

        const sqlite = new SQLite(':memory:');
        sqlite.exec(`
            CREATE TABLE users (
                id                 TEXT    PRIMARY KEY,
                name               TEXT    NOT NULL,
                deleted            INTEGER NOT NULL DEFAULT 0,
                replicache_version INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE replicache_clients (
                client_id            TEXT    PRIMARY KEY,
                client_group_id      TEXT    NOT NULL DEFAULT '',
                last_mutation_id     INTEGER NOT NULL DEFAULT 0,
                confirmed_at_version INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE replicache_server_version (
                id      INTEGER PRIMARY KEY DEFAULT 1,
                version INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO replicache_server_version (id, version) VALUES (1, 1);
        `);

        const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
        const commit = buildSqliteCommit(sqlite, ['users']);

        await processPush(db, {
            profileID: 'p1',
            clientGroupID: 'g1',
            pushVersion: 1,
            schemaVersion: '',
            mutations: [{ clientID: 'c1', id: 1, name: 'createUser', args: { id: 'u1', name: 'Alice' }, timestamp: Date.now() }],
        }, toPushOptions(mutations, db, commit));

        const res = await buildPullResponse(db, toPullEntities(dbMeta), {
            profileID: 'p1',
            clientGroupID: 'g1',
            cookie: null,
            pullVersion: 1,
            schemaVersion: '',
        });

        const putOp = res.patch.find((p: any) => p.op === 'put' && p.key === 'user/u1') as any;
        expect(putOp).toBeDefined();
        expect(putOp.value).toMatchObject({ id: 'u1', name: 'Alice' });

        await db.destroy();
    });

    // const entity1 = createEntity('user', {
    //     id: 'u1',
    //     name: 'Alice',
    // });
    
});