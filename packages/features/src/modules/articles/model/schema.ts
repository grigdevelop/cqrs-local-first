import type { Insertable, Selectable } from 'kysely';

export interface ArticleTable {
    id: string;
    user_id: string;
    title: string;
    body: string;
    published: number;
    deleted: number;
    replicache_version: number;
}

export type ArticleRow = Selectable<ArticleTable>;
export type NewArticle = Insertable<ArticleTable>;

export type Article = {
    id: string;
    title: string;
    body: string;
    published: boolean;
};

export function rowToArticle(row: ArticleRow): Article {
    return {
        id: row.id,
        title: row.title,
        body: row.body,
        published: row.published !== 0,
    };
}
