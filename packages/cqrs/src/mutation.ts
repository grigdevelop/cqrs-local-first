import {
    OperationDefinition,
    createOperation,
    ExtractInput,
    ExtractOutput,
    createHandler,
    HandlerInstance,
    ExtractHandlerDefinitions,
    InputForType,
    OutputForType
} from "./operation";

export type CreateMutationResult<TType extends string, TPayload, TOutput> = OperationDefinition<TType, TPayload, TOutput>;

export const createMutation = createOperation;

export type ExtractMutationInput<T> = ExtractInput<T>;

export type ExtractMutationOutput<T> = ExtractOutput<T>;

export const createMutationHandler = createHandler;

export type MutationHandlerInstance = HandlerInstance;

export type ExtractHandlerMutations<THandlers extends MutationHandlerInstance[]> = ExtractHandlerDefinitions<THandlers>;

export type InputForMutationType<THandlers extends MutationHandlerInstance[], TType extends string> = InputForType<THandlers, TType>;

export type OutputForMutationType<THandlers extends MutationHandlerInstance[], TType extends string> = OutputForType<THandlers, TType>;
