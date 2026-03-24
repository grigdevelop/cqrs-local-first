import { injectable } from 'inversify';
import { createQueryHandler, createMutationHandler } from 'cqrs';
import type { ExtractQueryInput, ExtractQueryOutput, ExtractMutationInput, ExtractMutationOutput } from 'cqrs';
import { store } from './store';
import {
    getTodosOperation,
    createTodoOperation,
    toggleTodoOperation,
    deleteTodoOperation,
} from './operations';

@injectable()
export class GetTodosHandler extends createQueryHandler(getTodosOperation) {
    async execute(_input: ExtractQueryInput<typeof getTodosOperation>): Promise<ExtractQueryOutput<typeof getTodosOperation>> {
        return store.getAll();
    }
}

@injectable()
export class CreateTodoHandler extends createMutationHandler(createTodoOperation) {
    async execute(input: ExtractMutationInput<typeof createTodoOperation>): Promise<ExtractMutationOutput<typeof createTodoOperation>> {
        return store.create(input.input.text);
    }
}

@injectable()
export class ToggleTodoHandler extends createMutationHandler(toggleTodoOperation) {
    async execute(input: ExtractMutationInput<typeof toggleTodoOperation>): Promise<ExtractMutationOutput<typeof toggleTodoOperation>> {
        return store.toggle(input.input.id);
    }
}

@injectable()
export class DeleteTodoHandler extends createMutationHandler(deleteTodoOperation) {
    async execute(input: ExtractMutationInput<typeof deleteTodoOperation>): Promise<ExtractMutationOutput<typeof deleteTodoOperation>> {
        return store.delete(input.input.id);
    }
}
