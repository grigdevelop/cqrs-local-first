import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { injectable, inject } from 'inversify';
import { createQuery, createQueryHandler, ExtractQueryInput, ExtractQueryOutput } from './query';
import { createMutation, createMutationHandler, ExtractMutationInput, ExtractMutationOutput } from './mutation';
import { createApplication, createClientMutators } from './application';
import { HandlerNotFoundError, ValidationError } from './errors';
import type { WriteTransaction } from 'replicache';

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

        it('throws HandlerNotFoundError when no handler is registered for the query type', () => {
            const app = createApplication({});
            // @ts-expect-error — intentionally using unknown type
            expect(() => app.executeQuery('unknown', {})).toThrow(HandlerNotFoundError);
            try {
                // @ts-expect-error
                app.executeQuery('unknown', {});
            } catch (err) {
                expect(err).toBeInstanceOf(HandlerNotFoundError);
                expect((err as HandlerNotFoundError).kind).toBe('query');
                expect((err as HandlerNotFoundError).operationType).toBe('unknown');
            }
        });
    });

    describe('executeMutation', () => {
        it('dispatches to the registered mutation handler', async () => {
            const app = createApplication({ mutations: [AddMutationHandler] });
            const result = await app.executeMutation('add', { a: 3, b: 4 });
            expect(result).toBe(7);
        });

        it('throws HandlerNotFoundError when no handler is registered for the mutation type', () => {
            const app = createApplication({});
            // @ts-expect-error — intentionally using unknown type
            expect(() => app.executeMutation('unknown', {})).toThrow(HandlerNotFoundError);
            try {
                // @ts-expect-error
                app.executeMutation('unknown', {});
            } catch (err) {
                expect(err).toBeInstanceOf(HandlerNotFoundError);
                expect((err as HandlerNotFoundError).kind).toBe('mutation');
                expect((err as HandlerNotFoundError).operationType).toBe('unknown');
            }
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

    describe('output validation', () => {
        it('strips unknown fields from query output', async () => {
            const strictQuery = createQuery('strict', z.void(), z.object({ x: z.number() }));
            type StrictInput = ExtractQueryInput<typeof strictQuery>;

            @injectable()
            class StrictQueryHandler extends createQueryHandler(strictQuery) {
                async execute(_input: StrictInput) {
                    // Handler returns extra field that isn't in the output schema.
                    return { x: 1, extra: 'should be stripped' } as any;
                }
            }

            const app = createApplication({ queries: [StrictQueryHandler] });
            const result = await app.executeQuery('strict', undefined);
            expect(result).toEqual({ x: 1 });
            expect((result as any).extra).toBeUndefined();
        });

        it('throws ValidationError(phase=output) when query output fails validation', async () => {
            const badOutputQuery = createQuery('badOutput', z.void(), z.number());
            type BadOutputInput = ExtractQueryInput<typeof badOutputQuery>;

            @injectable()
            class BadOutputQueryHandler extends createQueryHandler(badOutputQuery) {
                async execute(_input: BadOutputInput): Promise<any> {
                    return 'not-a-number';
                }
            }

            const app = createApplication({ queries: [BadOutputQueryHandler] });
            await expect(app.executeQuery('badOutput', undefined)).rejects.toThrow(ValidationError);
            await app.executeQuery('badOutput', undefined).catch(err => {
                expect((err as ValidationError).phase).toBe('output');
                expect((err as ValidationError).operationType).toBe('badOutput');
            });
        });

        it('throws ValidationError(phase=output) when mutation output fails validation', async () => {
            const badOutputMutation = createMutation('badOutputMut', z.void(), z.boolean());
            type BadOutputMutInput = ExtractMutationInput<typeof badOutputMutation>;

            @injectable()
            class BadOutputMutationHandler extends createMutationHandler(badOutputMutation) {
                async execute(_input: BadOutputMutInput): Promise<any> {
                    return 42;
                }
            }

            const app = createApplication({ mutations: [BadOutputMutationHandler] });
            await expect(app.executeMutation('badOutputMut', undefined)).rejects.toThrow(ValidationError);
            await app.executeMutation('badOutputMut', undefined).catch(err => {
                expect((err as ValidationError).phase).toBe('output');
                expect((err as ValidationError).operationType).toBe('badOutputMut');
            });
        });

        it('strips unknown fields from mutation output', async () => {
            const strictMutation = createMutation('strictMut', z.void(), z.object({ id: z.string() }));
            type StrictMutInput = ExtractMutationInput<typeof strictMutation>;

            @injectable()
            class StrictMutationHandler extends createMutationHandler(strictMutation) {
                async execute(_input: StrictMutInput) {
                    return { id: 'abc', secret: 'should be stripped' } as any;
                }
            }

            const app = createApplication({ mutations: [StrictMutationHandler] });
            const result = await app.executeMutation('strictMut', undefined);
            expect(result).toEqual({ id: 'abc' });
            expect((result as any).secret).toBeUndefined();
        });
    });

    describe('input validation', () => {
        const app = createApplication({
            queries: [EchoQueryHandler],
            mutations: [AddMutationHandler],
        });

        it('throws ValidationError(phase=input) when query input fails validation', () => {
            // @ts-expect-error — intentionally passing wrong shape
            expect(() => app.executeQuery('echo', { message: 123 })).toThrow(ValidationError);
            try {
                // @ts-expect-error
                app.executeQuery('echo', { message: 123 });
            } catch (err) {
                expect((err as ValidationError).phase).toBe('input');
                expect((err as ValidationError).operationType).toBe('echo');
            }
        });

        it('throws ValidationError(phase=input) when mutation input fails validation', () => {
            // @ts-expect-error — intentionally passing wrong shape
            expect(() => app.executeMutation('add', { a: 'not-a-number', b: 4 })).toThrow(ValidationError);
            try {
                // @ts-expect-error
                app.executeMutation('add', { a: 'not-a-number', b: 4 });
            } catch (err) {
                expect((err as ValidationError).phase).toBe('input');
                expect((err as ValidationError).operationType).toBe('add');
            }
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

describe('createClientMutators', () => {
    const app = createApplication({ mutations: [AddMutationHandler] });

    it('returns the mutators object', () => {
        const mutators = createClientMutators<typeof app>({
            add: async (_tx, _input) => {},
        });
        expect(typeof mutators.add).toBe('function');
    });

    it('calls the mutator with the tx and input', async () => {
        const mockTx: WriteTransaction = {
            set: vi.fn(),
            del: vi.fn(),
            get: vi.fn(),
            has: vi.fn(),
        } as unknown as WriteTransaction;

        const mutators = createClientMutators<typeof app>({
            add: async (tx, input) => {
                await tx.set('result', input.a + input.b);
            },
        });

        await mutators.add(mockTx, { a: 2, b: 3 });
        expect(mockTx.set).toHaveBeenCalledWith('result', 5);
    });
});
