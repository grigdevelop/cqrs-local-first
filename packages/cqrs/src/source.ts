import { z } from "zod";
import { createQuery, createQueryHandler, ExtractQueryInput, ExtractQueryOutput } from "./query";
import { createMutation, createMutationHandler, ExtractMutationInput, ExtractMutationOutput } from './mutation';
import { createApplication } from "./application";

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

class TestQueryHandler extends createQueryHandler(testQuery) {
    async execute(input: GetTestQueryInput): Promise<GetTestQueryOutput> {
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

class TestMutationHandler extends createMutationHandler(testMutation) {
    async execute(input: CreateTestMutationInput): Promise<CreateTestMutationOutput> {
        return true;
    }
}


const app = createApplication({
    queries: [new TestQueryHandler()],
    mutations: [new TestMutationHandler()]
});

// executeQuery is strongly typed:
// - type is constrained to 'testQuery'
// - input is typed as string
// - return is Promise<number>
app.executeQuery('testQuery', { name: 'hello' }).then(console.log);

// executeMutation is strongly typed:
// - type is constrained to 'testMutation'
// - input is typed as { id: string; value: number }
// - return is Promise<boolean>
app.executeMutation('testMutation', { id: '1', value: 42 }).then(console.log);