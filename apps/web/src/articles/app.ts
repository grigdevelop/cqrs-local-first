import { createArticleModule } from 'features/articles';
import { db } from '@/db/database';

export function createUserArticleApp(userId: string) {
    return createArticleModule(db, userId);
}

export type { ArticleModuleApplication as Application } from 'features/articles';
