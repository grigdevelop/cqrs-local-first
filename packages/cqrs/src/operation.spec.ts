import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { injectable } from 'inversify';
import { createOperation, createHandler } from './operation';

describe('createOperation', () => {
    it('stores the type string', () => {
        const op = createOperation('myOp', z.string(), z.number());
        expect(op.type).toBe('myOp');
    });

    it('stores the input and output schemas by reference', () => {
        const inputSchema = z.object({ foo: z.string() });
        const outputSchema = z.number();
        const op = createOperation('myOp', inputSchema, outputSchema);
        expect(op.input).toBe(inputSchema);
        expect(op.output).toBe(outputSchema);
    });
});

describe('createHandler', () => {
    const op = createOperation(
        'greet',
        z.object({ name: z.string() }),
        z.string()
    );

    it('attaches the definition to each handler instance', () => {
        @injectable()
        class GreetHandler extends createHandler(op) {
            async execute() { return 'hi'; }
        }

        const handler = new GreetHandler();
        expect(handler.definition).toBe(op);
    });

    it('different handlers from different operations have their own definitions', () => {
        const opA = createOperation('opA', z.string(), z.number());
        const opB = createOperation('opB', z.number(), z.boolean());

        @injectable()
        class HandlerA extends createHandler(opA) {
            async execute() { return 1; }
        }

        @injectable()
        class HandlerB extends createHandler(opB) {
            async execute() { return true; }
        }

        expect(new HandlerA().definition.type).toBe('opA');
        expect(new HandlerB().definition.type).toBe('opB');
    });

    it('execute is called with the operation input and returns the output', async () => {
        @injectable()
        class GreetHandler extends createHandler(op) {
            async execute(input: { type: 'greet'; input: { name: string } }) {
                return `hello, ${input.input.name}`;
            }
        }

        const handler = new GreetHandler();
        const result = await handler.execute({ type: 'greet', input: { name: 'world' } });
        expect(result).toBe('hello, world');
    });
});
