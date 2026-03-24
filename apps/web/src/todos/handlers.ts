import { injectable } from 'inversify';
import { createQueryHandler, createMutationHandler } from 'cqrs';
import type { ExtractQueryInput, ExtractQueryOutput, ExtractMutationInput, ExtractMutationOutput } from 'cqrs';
import { db } from '@/db/database';
import { rowToTodo } from '@/db/schema';
import {
    getTodosOperation,
    createTodoOperation,
    toggleTodoOperation,
    deleteTodoOperation,
} from './operations';

@injectable()
export class GetTodosHandler extends createQueryHandler(getTodosOperation) {
    async execute(_input: ExtractQueryInput<typeof getTodosOperation>): Promise<ExtractQueryOutput<typeof getTodosOperation>> {
        const rows = await db.selectFrom('todos').selectAll().execute();
        return rows.map(rowToTodo);
    }
}

@injectable()
export class CreateTodoHandler extends createMutationHandler(createTodoOperation) {
    async execute(input: ExtractMutationInput<typeof createTodoOperation>): Promise<ExtractMutationOutput<typeof createTodoOperation>> {
        const id = crypto.randomUUID();
        await db.insertInto('todos').values({ id, text: input.input.text, done: 0 }).execute();
        return { id, text: input.input.text, done: false };
    }
}

@injectable()
export class ToggleTodoHandler extends createMutationHandler(toggleTodoOperation) {
    async execute(input: ExtractMutationInput<typeof toggleTodoOperation>): Promise<ExtractMutationOutput<typeof toggleTodoOperation>> {
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
    async execute(input: ExtractMutationInput<typeof deleteTodoOperation>): Promise<ExtractMutationOutput<typeof deleteTodoOperation>> {
        await db.deleteFrom('todos').where('id', '=', input.input.id).execute();
    }
}
