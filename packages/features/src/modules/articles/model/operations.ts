import { z } from 'zod';
import {
    createMutation,
    createQuery,
    ExtractMutationInput,
    ExtractMutationOutput,
    ExtractQueryInput,
    ExtractQueryOutput,
} from 'cqrs';

export const ArticleSchema = z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    published: z.boolean(),
});

export const getArticlesOperation = createQuery('getArticles', z.void(), z.array(ArticleSchema));
export type GetArticlesInput = ExtractQueryInput<typeof getArticlesOperation>;
export type GetArticlesOutput = ExtractQueryOutput<typeof getArticlesOperation>;

export const createArticleOperation = createMutation(
    'createArticle',
    z.object({ title: z.string().min(1), body: z.string().min(1), id: z.string() }),
    ArticleSchema,
);
export type CreateArticleInput = ExtractMutationInput<typeof createArticleOperation>;
export type CreateArticleOutput = ExtractMutationOutput<typeof createArticleOperation>;

export const toggleArticlePublishedOperation = createMutation(
    'toggleArticlePublished',
    z.object({ id: z.string() }),
    z.void(),
);
export type ToggleArticlePublishedInput = ExtractMutationInput<typeof toggleArticlePublishedOperation>;
export type ToggleArticlePublishedOutput = ExtractMutationOutput<typeof toggleArticlePublishedOperation>;

export const deleteArticleOperation = createMutation('deleteArticle', z.object({ id: z.string() }), z.void());
export type DeleteArticleInput = ExtractMutationInput<typeof deleteArticleOperation>;
export type DeleteArticleOutput = ExtractMutationOutput<typeof deleteArticleOperation>;

export const mutationEntityTable = new Map<string, string | null>([
    [createArticleOperation.type, 'articles'],
    [toggleArticlePublishedOperation.type, 'articles'],
    [deleteArticleOperation.type, 'articles'],
]);
