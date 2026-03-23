import { HandlerInstance, ExtractHandlerDefinitions, InputForType, OutputForType } from "./operation";

export function createApplication<
    TQueryHandlers extends HandlerInstance[],
    TMutationHandlers extends HandlerInstance[]
>(options: {
    queries?: TQueryHandlers;
    mutations?: TMutationHandlers;
}) {
    class Application {
        queryHandlers = new Map<string, HandlerInstance>();
        mutationHandlers = new Map<string, HandlerInstance>();

        constructor() {
            for (const handler of options.queries ?? []) {
                this.queryHandlers.set(handler.definition.type, handler);
            }
            for (const handler of options.mutations ?? []) {
                this.mutationHandlers.set(handler.definition.type, handler);
            }
        }

        executeQuery<TType extends ExtractHandlerDefinitions<TQueryHandlers>['type']>(
            type: TType,
            input: InputForType<TQueryHandlers, TType>
        ): Promise<OutputForType<TQueryHandlers, TType>> {
            const handler = this.queryHandlers.get(type);
            if (!handler) throw new Error(`No handler for query type: ${type}`);
            return handler.execute({ type, input }) as Promise<OutputForType<TQueryHandlers, TType>>;
        }

        executeMutation<TType extends ExtractHandlerDefinitions<TMutationHandlers>['type']>(
            type: TType,
            input: InputForType<TMutationHandlers, TType>
        ): Promise<OutputForType<TMutationHandlers, TType>> {
            const handler = this.mutationHandlers.get(type);
            if (!handler) throw new Error(`No handler for mutation type: ${type}`);
            return handler.execute({ type, input }) as Promise<OutputForType<TMutationHandlers, TType>>;
        }
    }
    return new Application();
}