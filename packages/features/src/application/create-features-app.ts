import { createApplication, createClientMutators } from 'cqrs';
import type { Kysely } from 'kysely';
import type { Replicache } from 'replicache';
import { APPLICATION_DB, APPLICATION_USER_ID } from './dependency-tokens';
import type { Article } from '../modules/articles';
import { mutationEntityTable as articleMutationEntityTable } from '../modules/articles';
import {
    CreateArticleHandler,
    DeleteArticleHandler,
    GetArticlesHandler,
    ToggleArticlePublishedHandler,
} from '../modules/articles/application/handlers';
import type { Todo } from '../modules/todos';
import { mutationEntityTable as todoMutationEntityTable } from '../modules/todos';
import {
    CreateTodoHandler,
    DeleteTodoHandler,
    GetTodosHandler,
    ToggleTodoHandler,
} from '../modules/todos/application/handlers';

export function createFeaturesApp(db: Kysely<any>, userId: string) {
    return createApplication({
        services: (container) => {
            container.bind(APPLICATION_DB).toConstantValue(db);
            container.bind(APPLICATION_USER_ID).toConstantValue(userId);
        },
        queries: [GetTodosHandler, GetArticlesHandler],
        mutations: [
            CreateTodoHandler,
            ToggleTodoHandler,
            DeleteTodoHandler,
            CreateArticleHandler,
            ToggleArticlePublishedHandler,
            DeleteArticleHandler,
        ],
    });
}

export type FeaturesApp = ReturnType<typeof createFeaturesApp>;

export const applicationMutationEntityMap = new Map<string, string | null>([
    ...todoMutationEntityTable,
    ...articleMutationEntityTable,
]);

export const applicationMutators = createClientMutators<FeaturesApp>({
    createTodo: async (tx, args) => {
        await tx.set(`todo/${args.id}`, { id: args.id, text: args.text, done: false });
    },
    toggleTodo: async (tx, args) => {
        const todo = (await tx.get(`todo/${args.id}`)) as Todo | undefined;
        if (todo) await tx.set(`todo/${args.id}`, { ...todo, done: !todo.done });
    },
    deleteTodo: async (tx, args) => {
        await tx.del(`todo/${args.id}`);
    },
    createArticle: async (tx, args) => {
        await tx.set(`article/${args.id}`, { id: args.id, title: args.title, body: args.body, published: false });
    },
    toggleArticlePublished: async (tx, args) => {
        const article = (await tx.get(`article/${args.id}`)) as Article | undefined;
        if (article) await tx.set(`article/${args.id}`, { ...article, published: !article.published });
    },
    deleteArticle: async (tx, args) => {
        await tx.del(`article/${args.id}`);
    },
});

export type ApplicationReplicache = Replicache<typeof applicationMutators>;
