import { injectable, inject } from 'inversify';
import type { Kysely } from 'kysely';
import { createQueryHandler, createMutationHandler } from 'cqrs';
import { rowToTodo, type TodoRow } from './schema';
import {
    getTodosOperation,
    createTodoOperation,
    toggleTodoOperation,
    deleteTodoOperation,
    type GetTodosInput,
    type GetTodosOutput,
    type CreateTodoInput,
    type CreateTodoOutput,
    type ToggleTodoInput,
    type ToggleTodoOutput,
    type DeleteTodoInput,
    type DeleteTodoOutput,
} from './operations';

/** DI token for the Kysely database instance. Bind it via createTodoApp(). */
export const DB = Symbol('DB');

@injectable()
export class GetTodosHandler extends createQueryHandler(getTodosOperation) {
    constructor(@inject(DB) private db: Kysely<any>) { super(); }

    async execute(_input: GetTodosInput): Promise<GetTodosOutput> {
        const rows = await this.db
            .selectFrom('todos')
            .selectAll()
            .where('deleted', '=', 0)
            .execute() as TodoRow[];
        return rows.map(rowToTodo);
    }
}

@injectable()
export class CreateTodoHandler extends createMutationHandler(createTodoOperation) {
    constructor(@inject(DB) private db: Kysely<any>) { super(); }

    async execute(input: CreateTodoInput): Promise<CreateTodoOutput> {
        const { id, text } = input.input;
        // replicache_version is left at 0; the push route stamps it inside its
        // atomic transaction after the handler returns.
        await this.db
            .insertInto('todos')
            .values({ id, text, done: 0, deleted: 0, replicache_version: 0 })
            .execute();
        return { id, text, done: false };
    }
}

@injectable()
export class ToggleTodoHandler extends createMutationHandler(toggleTodoOperation) {
    constructor(@inject(DB) private db: Kysely<any>) { super(); }

    async execute(input: ToggleTodoInput): Promise<ToggleTodoOutput> {
        const row = await this.db
            .selectFrom('todos')
            .select('done')
            .where('id', '=', input.input.id)
            .where('deleted', '=', 0)
            .executeTakeFirst() as { done: number } | undefined;
        if (!row) return;
        await this.db
            .updateTable('todos')
            .set({ done: row.done ? 0 : 1 })
            .where('id', '=', input.input.id)
            .execute();
    }
}

@injectable()
export class DeleteTodoHandler extends createMutationHandler(deleteTodoOperation) {
    constructor(@inject(DB) private db: Kysely<any>) { super(); }

    async execute(input: DeleteTodoInput): Promise<DeleteTodoOutput> {
        // Soft delete: keep the row so the pull handler can emit a `del` patch op
        // for clients that haven't synced yet.
        await this.db
            .updateTable('todos')
            .set({ deleted: 1 })
            .where('id', '=', input.input.id)
            .execute();
    }
}
