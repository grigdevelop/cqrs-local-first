import { injectable, inject } from 'inversify';
import type { Kysely } from 'kysely';
import { createMutationHandler, createQueryHandler } from 'cqrs';
import { rowToTodo, type TodoRow } from '../model/schema';
import {
    createTodoOperation,
    deleteTodoOperation,
    getTodosOperation,
    toggleTodoOperation,
    type CreateTodoInput,
    type CreateTodoOutput,
    type DeleteTodoInput,
    type DeleteTodoOutput,
    type GetTodosInput,
    type GetTodosOutput,
    type ToggleTodoInput,
    type ToggleTodoOutput,
} from '../model/operations';

export const DB = Symbol('TODOS_DB');
export const USER_ID = Symbol('TODOS_USER_ID');

@injectable()
export class GetTodosHandler extends createQueryHandler(getTodosOperation) {
    constructor(
        @inject(DB) private db: Kysely<any>,
        @inject(USER_ID) private userId: string,
    ) { super(); }

    async execute(_input: GetTodosInput): Promise<GetTodosOutput> {
        const rows = await this.db
            .selectFrom('todos')
            .selectAll()
            .where('user_id', '=', this.userId)
            .where('deleted', '=', 0)
            .execute() as TodoRow[];
        return rows.map(rowToTodo);
    }
}

@injectable()
export class CreateTodoHandler extends createMutationHandler(createTodoOperation) {
    constructor(
        @inject(DB) private db: Kysely<any>,
        @inject(USER_ID) private userId: string,
    ) { super(); }

    async execute(input: CreateTodoInput): Promise<CreateTodoOutput> {
        const { id, text } = input.input;
        await this.db
            .insertInto('todos')
            .values({ id, user_id: this.userId, text, done: 0, deleted: 0, replicache_version: 0 })
            .execute();
        return { id, text, done: false };
    }
}

@injectable()
export class ToggleTodoHandler extends createMutationHandler(toggleTodoOperation) {
    constructor(
        @inject(DB) private db: Kysely<any>,
        @inject(USER_ID) private userId: string,
    ) { super(); }

    async execute(input: ToggleTodoInput): Promise<ToggleTodoOutput> {
        const row = await this.db
            .selectFrom('todos')
            .select('done')
            .where('id', '=', input.input.id)
            .where('user_id', '=', this.userId)
            .where('deleted', '=', 0)
            .executeTakeFirst() as { done: number } | undefined;
        if (!row) return;
        await this.db
            .updateTable('todos')
            .set({ done: row.done ? 0 : 1 })
            .where('id', '=', input.input.id)
            .where('user_id', '=', this.userId)
            .execute();
    }
}

@injectable()
export class DeleteTodoHandler extends createMutationHandler(deleteTodoOperation) {
    constructor(
        @inject(DB) private db: Kysely<any>,
        @inject(USER_ID) private userId: string,
    ) { super(); }

    async execute(input: DeleteTodoInput): Promise<DeleteTodoOutput> {
        await this.db
            .updateTable('todos')
            .set({ deleted: 1 })
            .where('id', '=', input.input.id)
            .where('user_id', '=', this.userId)
            .execute();
    }
}
