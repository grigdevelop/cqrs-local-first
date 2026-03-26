import { z } from "zod";
import type { ColumnType } from 'kysely';

// Base schema
export const BaseEntitySchema = z.object({
    id: z.string(),
});

export const BaseSyncedEntitySchema = BaseEntitySchema.extend({
    deleted: z.boolean().optional().default(false),
    replicache_version: z.number(),
});

export type ZodSchemaToKyselyTable<T extends z.ZodObject<any>> = {
    [K in keyof T['shape']]: T['shape'][K] extends z.ZodOptional<infer U>
        ? U extends z.ZodType<infer V>
            ? ColumnType<V | undefined>
            : never
        : T['shape'][K] extends z.ZodDefault<infer U>
        ? U extends z.ZodType<infer V>
            ? ColumnType<V>
            : never
        : T['shape'][K] extends z.ZodType<infer V>
        ? ColumnType<V>
        : never;
};