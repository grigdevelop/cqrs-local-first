import { createApplication, createClientMutators } from 'cqrs';
import type { Kysely } from 'kysely';
import type { Replicache } from 'replicache';
import { FEATURES_DB, FEATURES_USER_ID } from './dependencies';
import type { Article } from './modules/articles';
import { mutationEntityTable as articleMutationEntityTable } from './modules/articles';
import {
    CreateArticleHandler,
    DeleteArticleHandler,
    GetArticlesHandler,
    ToggleArticlePublishedHandler,
} from './modules/articles/application/handlers';
import type { Todo } from './modules/todos';
import { mutationEntityTable as todoMutationEntityTable } from './modules/todos';
import {
    CreateTodoHandler,
    DeleteTodoHandler,
    GetTodosHandler,
    ToggleTodoHandler,
} from './modules/todos/application/handlers';

export function createFeaturesApplication(db: Kysely<any>, userId: string) {
    return createApplication({
        services: (container) => {
            container.bind(FEATURES_DB).toConstantValue(db);
            container.bind(FEATURES_USER_ID).toConstantValue(userId);
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

export type FeaturesApplication = ReturnType<typeof createFeaturesApplication>;

export const featuresMutationEntityTable = new Map<string, string | null>([
    ...todoMutationEntityTable,
    ...articleMutationEntityTable,
]);

export const featuresMutators = createClientMutators<FeaturesApplication>({
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

export type FeaturesReplicache = Replicache<typeof featuresMutators>;
