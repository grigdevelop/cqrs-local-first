import { z } from "zod";
import { injectable, inject } from "inversify";
import { createQuery, createQueryHandler, ExtractQueryInput, ExtractQueryOutput } from "./query";
import { createMutation, createMutationHandler, ExtractMutationInput, ExtractMutationOutput } from './mutation';
import type { WriteTransaction } from "replicache";
import { createApplication } from "./application";

// ----
// Example services
// ----

const LoggerToken = Symbol('Logger');

interface Logger {
    log(msg: string): void;
}

@injectable()
class ConsoleLogger implements Logger {
    log(msg: string) {
        console.log('[LOG]', msg);
    }
}

// ----
// Example usage
// ----

type GetTestQueryInput = ExtractQueryInput<typeof testQuery>;
type GetTestQueryOutput = ExtractQueryOutput<typeof testQuery>;

const testQuery = createQuery(
    'testQuery', 
    z.object({ name: z.string() }), 
    z.number()
);

@injectable()
class TestQueryHandler extends createQueryHandler(testQuery) {
    constructor(@inject(LoggerToken) private logger: Logger) {
        super();
    }

    async execute(input: GetTestQueryInput): Promise<GetTestQueryOutput> {
        this.logger.log(`executing testQuery with name: ${input.input.name}`);
        return 42;
    }
}

type CreateTestMutationInput = ExtractMutationInput<typeof testMutation>;
type CreateTestMutationOutput = ExtractMutationOutput<typeof testMutation>;

const testMutation = createMutation(
    'testMutation',
    z.object({ id: z.string(), value: z.number() }),
    z.boolean()
);

@injectable()
class TestMutationHandler extends createMutationHandler(testMutation) {
    constructor(@inject(LoggerToken) private logger: Logger) {
        super();
    }

    async execute(input: CreateTestMutationInput): Promise<CreateTestMutationOutput> {
        this.logger.log(`executing testMutation with id: ${input.input.id}`);
        return true;
    }

    async mutate(tx: WriteTransaction, input: CreateTestMutationInput['input']): Promise<void> {
        await tx.set(`item/${input.id}`, { id: input.id, value: input.value });
    }
}

const app = createApplication({
    services: (container) => {
        container.bind<Logger>(LoggerToken).to(ConsoleLogger);
    },
    queries: [TestQueryHandler],
    mutations: [TestMutationHandler]
});

// executeQuery is strongly typed:
// - type is constrained to 'testQuery'
// - input is typed as { name: string }
// - return is Promise<number>
app.executeQuery('testQuery', { name: 'hello' }).then(console.log);

// executeMutation is strongly typed:
// - type is constrained to 'testMutation'
// - input is typed as { id: string; value: number }
// - return is Promise<boolean>
app.executeMutation('testMutation', { id: '1', value: 42 }).then(console.log);