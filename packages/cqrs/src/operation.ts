import { z } from "zod";
import { injectable } from "inversify";
import type { Newable } from "inversify";

export type OperationDefinition<TType extends string, TPayload, TOutput> = {
    type: TType;
    input: z.ZodType<TPayload>;
    output: z.ZodType<TOutput>;
};

export function createOperation<TType extends string, TPayload, TOutput>(
    type: TType,
    inputSchema: z.ZodType<TPayload>,
    outputSchema: z.ZodType<TOutput>
): OperationDefinition<TType, TPayload, TOutput> {
    return {
        type,
        input: inputSchema,
        output: outputSchema
    };
}

export type ExtractInput<T> = T extends OperationDefinition<infer TType, infer TPayload, unknown>
    ? { type: TType; input: TPayload }
    : never;

export type ExtractOutput<T> = T extends OperationDefinition<any, any, infer TOutput>
    ? TOutput
    : never;

export function createHandler<T extends OperationDefinition<string, unknown, unknown>>(definition: T) {
    @injectable()
    abstract class Handler {
        readonly definition = definition;
        abstract execute(input: ExtractInput<T>): Promise<ExtractOutput<T>>;
    }
    return Handler;
}

export interface HandlerInstance {
    readonly definition: OperationDefinition<string, any, any>;
    execute(input: any): Promise<any>;
}

export type HandlerClass = Newable<HandlerInstance>;

export type ExtractHandlerDefinitions<THandlers extends HandlerInstance[]> = THandlers[number]['definition'];

export type InputForType<THandlers extends HandlerInstance[], TType extends string> =
    Extract<ExtractHandlerDefinitions<THandlers>, { type: TType }> extends OperationDefinition<any, infer TPayload, any>
        ? TPayload
        : never;

export type OutputForType<THandlers extends HandlerInstance[], TType extends string> =
    Extract<ExtractHandlerDefinitions<THandlers>, { type: TType }> extends OperationDefinition<any, any, infer TOutput>
        ? TOutput
        : never;
