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

export type CreateQueryResult<TType extends string, TPayload, TOutput> = OperationDefinition<TType, TPayload, TOutput>;

export const createQuery = createOperation;

export type ExtractQueryInput<T> = ExtractInput<T>;

export type ExtractQueryOutput<T> = ExtractOutput<T>;

export const createQueryHandler = createHandler;

export type QueryHandlerInstance = HandlerInstance;

export type ExtractHandlerQueries<THandlers extends QueryHandlerInstance[]> = ExtractHandlerDefinitions<THandlers>;

export type InputForQueryType<THandlers extends QueryHandlerInstance[], TType extends string> = InputForType<THandlers, TType>;

export type OutputForQueryType<THandlers extends QueryHandlerInstance[], TType extends string> = OutputForType<THandlers, TType>;