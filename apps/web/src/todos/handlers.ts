import { injectable } from 'inversify';
import { createQueryHandler, createMutationHandler } from 'cqrs';
import { db } from '@/db/database';
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
        const rows = await db.selectFrom('todos').selectAll().execute();
        return rows.map(rowToTodo);
    }
}

@injectable()
export class CreateTodoHandler extends createMutationHandler(createTodoOperation) {
    async execute(input: CreateTodoInput): Promise<CreateTodoOutput> {
        const { id, text } = input.input;
        await db.insertInto('todos').values({ id, text, done: 0 }).execute();
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
            .executeTakeFirst();
        if (!row) return;
        await db
            .updateTable('todos')
            .set({ done: row.done ? 0 : 1 })
            .where('id', '=', input.input.id)
            .execute();
    }
}

@injectable()
export class DeleteTodoHandler extends createMutationHandler(deleteTodoOperation) {
    async execute(input: DeleteTodoInput): Promise<DeleteTodoOutput> {
        await db.deleteFrom('todos').where('id', '=', input.input.id).execute();
    }
}
