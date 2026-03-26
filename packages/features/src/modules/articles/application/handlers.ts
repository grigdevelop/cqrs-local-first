import { injectable, inject } from 'inversify';
import type { Kysely } from 'kysely';
import { createMutationHandler, createQueryHandler } from 'cqrs';
import { rowToArticle, type ArticleRow } from '../model/schema';
import {
    createArticleOperation,
    deleteArticleOperation,
    getArticlesOperation,
    toggleArticlePublishedOperation,
    type CreateArticleInput,
    type CreateArticleOutput,
    type DeleteArticleInput,
    type DeleteArticleOutput,
    type GetArticlesInput,
    type GetArticlesOutput,
    type ToggleArticlePublishedInput,
    type ToggleArticlePublishedOutput,
} from '../model/operations';

export const DB = Symbol('ARTICLES_DB');
export const USER_ID = Symbol('ARTICLES_USER_ID');

@injectable()
export class GetArticlesHandler extends createQueryHandler(getArticlesOperation) {
    constructor(@inject(DB) private db: Kysely<any>, @inject(USER_ID) private userId: string) { super(); }

    async execute(_input: GetArticlesInput): Promise<GetArticlesOutput> {
        const rows = await this.db
            .selectFrom('articles')
            .selectAll()
            .where('user_id', '=', this.userId)
            .where('deleted', '=', 0)
            .execute() as ArticleRow[];
        return rows.map(rowToArticle);
    }
}

@injectable()
export class CreateArticleHandler extends createMutationHandler(createArticleOperation) {
    constructor(@inject(DB) private db: Kysely<any>, @inject(USER_ID) private userId: string) { super(); }

    async execute(input: CreateArticleInput): Promise<CreateArticleOutput> {
        const { id, title, body } = input.input;
        await this.db
            .insertInto('articles')
            .values({ id, user_id: this.userId, title, body, published: 0, deleted: 0, replicache_version: 0 })
            .execute();
        return { id, title, body, published: false };
    }
}

@injectable()
export class ToggleArticlePublishedHandler extends createMutationHandler(toggleArticlePublishedOperation) {
    constructor(@inject(DB) private db: Kysely<any>, @inject(USER_ID) private userId: string) { super(); }

    async execute(input: ToggleArticlePublishedInput): Promise<ToggleArticlePublishedOutput> {
        const row = await this.db
            .selectFrom('articles')
            .select('published')
            .where('id', '=', input.input.id)
            .where('user_id', '=', this.userId)
            .where('deleted', '=', 0)
            .executeTakeFirst() as { published: number } | undefined;
        if (!row) return;
        await this.db
            .updateTable('articles')
            .set({ published: row.published ? 0 : 1 })
            .where('id', '=', input.input.id)
            .where('user_id', '=', this.userId)
            .execute();
    }
}

@injectable()
export class DeleteArticleHandler extends createMutationHandler(deleteArticleOperation) {
    constructor(@inject(DB) private db: Kysely<any>, @inject(USER_ID) private userId: string) { super(); }

    async execute(input: DeleteArticleInput): Promise<DeleteArticleOutput> {
        await this.db
            .updateTable('articles')
            .set({ deleted: 1 })
            .where('id', '=', input.input.id)
            .where('user_id', '=', this.userId)
            .execute();
    }
}
