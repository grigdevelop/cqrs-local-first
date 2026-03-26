import type { SyncedEntity } from 'replicache-sync';
import { rowToArticle, type Article, type ArticleRow } from './schema';

export const articleEntity: SyncedEntity<ArticleRow, Article> = {
    tableName: 'articles',
    keyPrefix: 'article',
    toValue: rowToArticle,
};
