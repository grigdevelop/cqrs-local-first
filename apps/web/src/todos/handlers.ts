import { injectable } from 'inversify';
import { createQueryHandler, createMutationHandler } from 'cqrs';
import { db, getNextVersion } from '@/db/database';
import { rowToTodo } from '@/db/schema';
import {
    getTodosOperation,
    createTodoOperation,
    toggleTodoOperation,
    deleteTodoOperation,
    GetTodosInput,
    GetTodosOutput,
    CreateTodoInput,
    CreateTodoOutput,
    ToggleTodoInput,
    ToggleTodoOutput,
    DeleteTodoInput,
    DeleteTodoOutput,
} from './operations';

@injectable()
export class GetTodosHandler extends createQueryHandler(getTodosOperation) {
    async execute(_input: GetTodosInput): Promise<GetTodosOutput> {
        const rows = await db.selectFrom('todos').selectAll().where('deleted', '=', 0).execute();
        return rows.map(rowToTodo);
    }
}

@injectable()
export class CreateTodoHandler extends createMutationHandler(createTodoOperation) {
    async execute(input: CreateTodoInput): Promise<CreateTodoOutput> {
        const { id, text } = input.input;
        const version = getNextVersion();
        await db.insertInto('todos').values({ id, text, done: 0, deleted: 0, replicache_version: version }).execute();
        return { id, text, done: false };
    }
}

@injectable()
export class ToggleTodoHandler extends createMutationHandler(toggleTodoOperation) {
    async execute(input: ToggleTodoInput): Promise<ToggleTodoOutput> {
        const row = await db
            .selectFrom('todos')
            .select('done')
            .where('id', '=', input.input.id)
            .where('deleted', '=', 0)
            .executeTakeFirst();
        if (!row) return;
        const version = getNextVersion();
        await db
            .updateTable('todos')
            .set({ done: row.done ? 0 : 1, replicache_version: version })
            .where('id', '=', input.input.id)
            .execute();
    }
}

@injectable()
export class DeleteTodoHandler extends createMutationHandler(deleteTodoOperation) {
    async execute(input: DeleteTodoInput): Promise<DeleteTodoOutput> {
        const version = getNextVersion();
        // Soft delete: keep the row so the pull handler can emit a `del` patch op
        // for clients that haven't synced yet. A hard DELETE would leave those
        // clients with a stale key they'd never be told to remove.
        await db
            .updateTable('todos')
            .set({ deleted: 1, replicache_version: version })
            .where('id', '=', input.input.id)
            .execute();
    }
}
