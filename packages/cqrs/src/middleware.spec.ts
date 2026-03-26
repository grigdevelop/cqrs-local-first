import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { injectable } from 'inversify';
import { createQuery, createQueryHandler, ExtractQueryInput, ExtractQueryOutput } from './query';
import { createMutation, createMutationHandler, ExtractMutationInput, ExtractMutationOutput } from './mutation';
import { createApplication } from './application';
import type { MiddlewareFn, MiddlewareContext } from './middleware';
import { runPipeline } from './middleware';

// ---- shared operations ----

const echoQuery = createQuery('echo', z.object({ message: z.string() }), z.string());
type EchoInput = ExtractQueryInput<typeof echoQuery>;
type EchoOutput = ExtractQueryOutput<typeof echoQuery>;

@injectable()
class EchoHandler extends createQueryHandler(echoQuery) {
    async execute(input: EchoInput): Promise<EchoOutput> {
        return input.input.message;
    }
}

const addMutation = createMutation('add', z.object({ a: z.number(), b: z.number() }), z.number());
type AddInput = ExtractMutationInput<typeof addMutation>;
type AddOutput = ExtractMutationOutput<typeof addMutation>;

@injectable()
class AddHandler extends createMutationHandler(addMutation) {
    async execute(input: AddInput): Promise<AddOutput> {
        return input.input.a + input.input.b;
    }
}

// ---------------------------------------------------------------------------
// runPipeline unit tests
// ---------------------------------------------------------------------------

describe('runPipeline', () => {
    const ctx: MiddlewareContext = { type: 'op', kind: 'query', input: {} };

    it('calls the handler when there is no middleware', async () => {
        const handler = vi.fn().mockResolvedValue('result');
        const output = await runPipeline(ctx, [], handler);
        expect(output).toBe('result');
        expect(handler).toHaveBeenCalledOnce();
    });

    it('calls a single middleware then the handler', async () => {
        const order: string[] = [];
        const mw: MiddlewareFn = async (_ctx, next) => {
            order.push('before');
            const result = await next();
            order.push('after');
            return result;
        };
        const handler = vi.fn(async () => { order.push('handler'); return 42; });

        await runPipeline(ctx, [mw], handler);
        expect(order).toEqual(['before', 'handler', 'after']);
    });

    it('invokes multiple middleware left-to-right, handler in the middle', async () => {
        const order: string[] = [];
        const make = (name: string): MiddlewareFn => async (_ctx, next) => {
            order.push(`${name}:enter`);
            const result = await next();
            order.push(`${name}:exit`);
            return result;
        };

        await runPipeline(ctx, [make('A'), make('B'), make('C')], async () => {
            order.push('handler');
            return null;
        });

        expect(order).toEqual([
            'A:enter', 'B:enter', 'C:enter',
            'handler',
            'C:exit', 'B:exit', 'A:exit',
        ]);
    });

    it('passes the context object to every middleware', async () => {
        const receivedContexts: MiddlewareContext[] = [];
        const mw: MiddlewareFn = async (c, next) => { receivedContexts.push(c); return next(); };

        await runPipeline(ctx, [mw, mw], async () => 'x');
        expect(receivedContexts).toHaveLength(2);
        expect(receivedContexts[0]).toBe(ctx);
        expect(receivedContexts[1]).toBe(ctx);
    });

    it('allows middleware to short-circuit without calling next', async () => {
        const handler = vi.fn().mockResolvedValue('from handler');
        const shortCircuit: MiddlewareFn = async (_ctx, _next) => 'short-circuited';

        const result = await runPipeline(ctx, [shortCircuit], handler);
        expect(result).toBe('short-circuited');
        expect(handler).not.toHaveBeenCalled();
    });

    it('allows middleware to replace the handler result', async () => {
        const mw: MiddlewareFn = async (_ctx, next) => {
            await next(); // discard original result
            return 'overridden';
        };
        const result = await runPipeline(ctx, [mw], async () => 'original');
        expect(result).toBe('overridden');
    });

    it('propagates errors thrown by the handler', async () => {
        const mw: MiddlewareFn = async (_ctx, next) => next();
        await expect(
            runPipeline(ctx, [mw], async () => { throw new Error('boom'); })
        ).rejects.toThrow('boom');
    });

    it('propagates errors thrown by middleware', async () => {
        const mw: MiddlewareFn = async () => { throw new Error('mw-boom'); };
        await expect(
            runPipeline(ctx, [mw], async () => 'ok')
        ).rejects.toThrow('mw-boom');
    });
});

// ---------------------------------------------------------------------------
// Integration tests via createApplication
// ---------------------------------------------------------------------------

describe('createApplication with middleware', () => {
    it('middleware is called for queries with correct context', async () => {
        const captured: MiddlewareContext[] = [];
        const mw: MiddlewareFn = async (ctx, next) => { captured.push(ctx); return next(); };

        const app = createApplication({ middleware: [mw], queries: [EchoHandler] });
        await app.executeQuery('echo', { message: 'hi' });

        expect(captured).toHaveLength(1);
        expect(captured[0]!.type).toBe('echo');
        expect(captured[0]!.kind).toBe('query');
        expect(captured[0]!.input).toEqual({ message: 'hi' });
    });

    it('middleware is called for mutations with correct context', async () => {
        const captured: MiddlewareContext[] = [];
        const mw: MiddlewareFn = async (ctx, next) => { captured.push(ctx); return next(); };

        const app = createApplication({ middleware: [mw], mutations: [AddHandler] });
        await app.executeMutation('add', { a: 2, b: 3 });

        expect(captured[0]!.type).toBe('add');
        expect(captured[0]!.kind).toBe('mutation');
        expect(captured[0]!.input).toEqual({ a: 2, b: 3 });
    });

    it('middleware receives already-validated input (extra fields stripped)', async () => {
        const captured: MiddlewareContext[] = [];
        const mw: MiddlewareFn = async (ctx, next) => { captured.push(ctx); return next(); };

        const app = createApplication({ middleware: [mw], queries: [EchoHandler] });
        // @ts-expect-error — passing extra field intentionally
        await app.executeQuery('echo', { message: 'hi', extra: 'dropped' });

        expect((captured[0]!.input as any).extra).toBeUndefined();
    });

    it('multiple middleware are called in registration order', async () => {
        const order: number[] = [];
        const make = (n: number): MiddlewareFn => async (_ctx, next) => {
            order.push(n);
            return next();
        };

        const app = createApplication({
            middleware: [make(1), make(2), make(3)],
            queries: [EchoHandler],
        });
        await app.executeQuery('echo', { message: 'x' });
        expect(order).toEqual([1, 2, 3]);
    });

    it('middleware can observe the handler result', async () => {
        const results: unknown[] = [];
        const mw: MiddlewareFn = async (_ctx, next) => {
            const result = await next();
            results.push(result);
            return result;
        };

        const app = createApplication({ middleware: [mw], queries: [EchoHandler] });
        await app.executeQuery('echo', { message: 'hello' });
        expect(results[0]).toBe('hello');
    });

    it('middleware error is propagated to the caller', async () => {
        const mw: MiddlewareFn = async () => { throw new Error('middleware-failure'); };
        const app = createApplication({ middleware: [mw], queries: [EchoHandler] });
        await expect(app.executeQuery('echo', { message: 'x' })).rejects.toThrow('middleware-failure');
    });

    it('handler error is propagated through middleware to the caller', async () => {
        const failQuery = createQuery('fail', z.void(), z.void());

        @injectable()
        class FailHandler extends createQueryHandler(failQuery) {
            async execute(): Promise<void> { throw new Error('handler-failure'); }
        }

        const mw: MiddlewareFn = async (_ctx, next) => next(); // transparent
        const app = createApplication({ middleware: [mw], queries: [FailHandler] });
        await expect(app.executeQuery('fail', undefined)).rejects.toThrow('handler-failure');
    });

    it('works without middleware (backward compat)', async () => {
        const app = createApplication({ queries: [EchoHandler] });
        const result = await app.executeQuery('echo', { message: 'plain' });
        expect(result).toBe('plain');
    });

    it('a logging middleware pattern collects timings without affecting the result', async () => {
        const logs: string[] = [];
        const timer: MiddlewareFn = async (ctx, next) => {
            const start = 0; // deterministic for test
            const result = await next();
            logs.push(`${ctx.kind}:${ctx.type} took ${Date.now() - start}ms`);
            return result;
        };

        const app = createApplication({
            middleware: [timer],
            mutations: [AddHandler],
        });
        const result = await app.executeMutation('add', { a: 10, b: 5 });
        expect(result).toBe(15);
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatch(/mutation:add took/);
    });
});
