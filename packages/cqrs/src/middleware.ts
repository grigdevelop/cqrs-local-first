/** Context passed to every middleware in the pipeline. */
export interface MiddlewareContext {
    /** The operation name, e.g. "createTodo". */
    readonly type: string;
    /** Whether this is a query or a mutation. */
    readonly kind: 'query' | 'mutation';
    /** The validated input — already parsed through the operation's input schema. */
    readonly input: unknown;
}

/**
 * A middleware function in the execution pipeline.
 *
 * Each middleware receives the operation context and a `next` function that
 * continues to the next middleware (or the handler itself). The return value
 * of `next()` is the raw handler output, before output schema validation.
 *
 * @example
 * const logger: MiddlewareFn = async (ctx, next) => {
 *     console.time(ctx.type);
 *     const result = await next();
 *     console.timeEnd(ctx.type);
 *     return result;
 * };
 */
export type MiddlewareFn = (
    ctx: MiddlewareContext,
    next: () => Promise<unknown>,
) => Promise<unknown>;

/**
 * Runs `handler` through the middleware chain and returns its result.
 * Middleware are invoked left-to-right; `handler` is the innermost function.
 */
export function runPipeline(
    ctx: MiddlewareContext,
    middleware: MiddlewareFn[],
    handler: () => Promise<unknown>,
): Promise<unknown> {
    const dispatch = (index: number): Promise<unknown> => {
        const mw = middleware[index];
        if (mw === undefined) return handler();
        return mw(ctx, () => dispatch(index + 1));
    };
    return dispatch(0);
}
