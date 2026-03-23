import { Container } from "inversify";
import { HandlerInstance, HandlerClass, OperationDefinition } from "./operation";

type DefinitionsOf<T extends HandlerClass[]> = InstanceType<T[number]>['definition'];

type InputFor<TDefs, TType extends string> =
    Extract<TDefs, { type: TType }> extends OperationDefinition<any, infer P, any> ? P : never;

type OutputFor<TDefs, TType extends string> =
    Extract<TDefs, { type: TType }> extends OperationDefinition<any, any, infer O> ? O : never;

export function createApplication<
    TQueryClasses extends HandlerClass[] = [],
    TMutationClasses extends HandlerClass[] = []
>(options: {
    services?: (container: Container) => void;
    queries?: TQueryClasses;
    mutations?: TMutationClasses;
}) {
    const container = new Container();

    if (options.services) {
        options.services(container);
    }

    class Application {
        queryHandlers = new Map<string, HandlerInstance>();
        mutationHandlers = new Map<string, HandlerInstance>();

        constructor() {
            for (const HandlerCls of (options.queries ?? []) as HandlerClass[]) {
                container.bind(HandlerCls).toSelf();
                const instance = container.get(HandlerCls);
                this.queryHandlers.set(instance.definition.type, instance);
            }
            for (const HandlerCls of (options.mutations ?? []) as HandlerClass[]) {
                container.bind(HandlerCls).toSelf();
                const instance = container.get(HandlerCls);
                this.mutationHandlers.set(instance.definition.type, instance);
            }
        }

        executeQuery<TType extends DefinitionsOf<TQueryClasses>['type']>(
            type: TType,
            input: InputFor<DefinitionsOf<TQueryClasses>, TType>
        ): Promise<OutputFor<DefinitionsOf<TQueryClasses>, TType>> {
            const handler = this.queryHandlers.get(type);
            if (!handler) throw new Error(`No handler for query type: ${type}`);
            return handler.execute({ type, input }) as Promise<OutputFor<DefinitionsOf<TQueryClasses>, TType>>;
        }

        executeMutation<TType extends DefinitionsOf<TMutationClasses>['type']>(
            type: TType,
            input: InputFor<DefinitionsOf<TMutationClasses>, TType>
        ): Promise<OutputFor<DefinitionsOf<TMutationClasses>, TType>> {
            const handler = this.mutationHandlers.get(type);
            if (!handler) throw new Error(`No handler for mutation type: ${type}`);
            return handler.execute({ type, input }) as Promise<OutputFor<DefinitionsOf<TMutationClasses>, TType>>;
        }
    }
    return new Application();
}