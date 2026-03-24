import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { injectable, inject } from 'inversify';
import { createQuery, createQueryHandler, ExtractQueryInput, ExtractQueryOutput } from './query';
import { createMutation, createMutationHandler, ExtractMutationInput, ExtractMutationOutput } from './mutation';
import { createApplication } from './application';

// ---- shared operation definitions ----

const echoQuery = createQuery(
    'echo',
    z.object({ message: z.string() }),
    z.string()
);

const addMutation = createMutation(
    'add',
    z.object({ a: z.number(), b: z.number() }),
    z.number()
);

// ---- simple handlers (no DI) ----

type EchoInput = ExtractQueryInput<typeof echoQuery>;
type EchoOutput = ExtractQueryOutput<typeof echoQuery>;

@injectable()
class EchoQueryHandler extends createQueryHandler(echoQuery) {
    async execute(input: EchoInput): Promise<EchoOutput> {
        return input.input.message;
    }
}

type AddInput = ExtractMutationInput<typeof addMutation>;
type AddOutput = ExtractMutationOutput<typeof addMutation>;

@injectable()
class AddMutationHandler extends createMutationHandler(addMutation) {
    async execute(input: AddInput): Promise<AddOutput> {
        return input.input.a + input.input.b;
    }
}

// ---- handlers with injected service ----

const LoggerToken = Symbol('Logger');
interface Logger { log(msg: string): void; }

const countQuery = createQuery('count', z.void(), z.number());
type CountInput = ExtractQueryInput<typeof countQuery>;
type CountOutput = ExtractQueryOutput<typeof countQuery>;

@injectable()
class CountQueryHandler extends createQueryHandler(countQuery) {
    constructor(@inject(LoggerToken) private logger: Logger) {
        super();
    }

    async execute(input: CountInput): Promise<CountOutput> {
        this.logger.log('count called');
        return 99;
    }
}

// ---- tests ----

describe('createApplication', () => {
    describe('executeQuery', () => {
        it('dispatches to the registered query handler', async () => {
            const app = createApplication({ queries: [EchoQueryHandler] });
            const result = await app.executeQuery('echo', { message: 'hi' });
            expect(result).toBe('hi');
        });

        it('throws when no handler is registered for the query type', () => {
            const app = createApplication({});
            // @ts-expect-error — intentionally using unknown type
            expect(() => app.executeQuery('unknown', {})).toThrow('No handler for query type: unknown');
        });
    });

    describe('executeMutation', () => {
        it('dispatches to the registered mutation handler', async () => {
            const app = createApplication({ mutations: [AddMutationHandler] });
            const result = await app.executeMutation('add', { a: 3, b: 4 });
            expect(result).toBe(7);
        });

        it('throws when no handler is registered for the mutation type', () => {
            const app = createApplication({});
            // @ts-expect-error — intentionally using unknown type
            expect(() => app.executeMutation('unknown', {})).toThrow('No handler for mutation type: unknown');
        });
    });

    describe('dependency injection', () => {
        it('injects registered services into handlers', async () => {
            const mockLogger: Logger = { log: vi.fn() };

            const app = createApplication({
                services: (container) => {
                    container.bind<Logger>(LoggerToken).toConstantValue(mockLogger);
                },
                queries: [CountQueryHandler],
            });

            const result = await app.executeQuery('count', undefined);
            expect(result).toBe(99);
            expect(mockLogger.log).toHaveBeenCalledWith('count called');
        });
    });

    describe('input validation', () => {
        const app = createApplication({
            queries: [EchoQueryHandler],
            mutations: [AddMutationHandler],
        });

        it('throws a ZodError when query input fails validation', () => {
            // @ts-expect-error — intentionally passing wrong shape
            expect(() => app.executeQuery('echo', { message: 123 })).toThrow();
        });

        it('throws a ZodError when mutation input fails validation', () => {
            // @ts-expect-error — intentionally passing wrong shape
            expect(() => app.executeMutation('add', { a: 'not-a-number', b: 4 })).toThrow();
        });

        it('strips unknown fields before passing input to the handler', async () => {
            const received: unknown[] = [];

            const spyQuery = createQuery('spy', z.object({ x: z.number() }), z.void());
            type SpyInput = ExtractQueryInput<typeof spyQuery>;

            @injectable()
            class SpyHandler extends createQueryHandler(spyQuery) {
                async execute(input: SpyInput) {
                    received.push(input.input);
                }
            }

            const spyApp = createApplication({ queries: [SpyHandler] });
            // @ts-expect-error — intentionally passing extra field
            await spyApp.executeQuery('spy', { x: 1, extra: 'dropped' });
            expect(received[0]).toEqual({ x: 1 });
        });
    });

    describe('with both queries and mutations', () => {
        it('handles mixed registration', async () => {
            const app = createApplication({
                queries: [EchoQueryHandler],
                mutations: [AddMutationHandler],
            });

            const echo = await app.executeQuery('echo', { message: 'test' });
            const sum = await app.executeMutation('add', { a: 10, b: 5 });

            expect(echo).toBe('test');
            expect(sum).toBe(15);
        });
    });
});
