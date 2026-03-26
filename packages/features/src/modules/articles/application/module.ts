import { createApplication } from 'cqrs';
import type { Kysely } from 'kysely';
import {
    CreateArticleHandler,
    DB,
    DeleteArticleHandler,
    GetArticlesHandler,
    ToggleArticlePublishedHandler,
    USER_ID,
} from './handlers';

export function createArticleModule(db: Kysely<any>, userId: string) {
    return createApplication({
        services: (container) => {
            container.bind(DB).toConstantValue(db);
            container.bind(USER_ID).toConstantValue(userId);
        },
        queries: [GetArticlesHandler],
        mutations: [CreateArticleHandler, ToggleArticlePublishedHandler, DeleteArticleHandler],
    });
}

export type ArticleModuleApplication = ReturnType<typeof createArticleModule>;
