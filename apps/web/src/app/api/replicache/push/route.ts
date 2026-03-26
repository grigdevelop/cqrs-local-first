import type { PushRequestV1 } from 'replicache';
import { processPush } from 'replicache-sync';
import { mutationEntityTable as articleMutationEntityTable } from 'features/articles';
import { mutationEntityTable as todoMutationEntityTable } from 'features/todos';
import { createUserArticleApp } from '@/articles/app';
import { createUserTodoApp } from '@/todos/app';
import { db, commitMutation } from '@/db/database';
import { getAuthenticatedUser } from '@/auth/jwt';

export async function POST(req: Request) {
    const user = await getAuthenticatedUser(db, req);
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const push = (await req.json()) as PushRequestV1;
    const todoApp = createUserTodoApp(user.id);
    const articleApp = createUserArticleApp(user.id);

    await processPush(db, push, {
        executeMutation: (name, args) => {
            if (articleMutationEntityTable.has(name)) {
                return (articleApp.executeMutation as (n: string, a: unknown) => Promise<unknown>)(name, args);
            }
            return (todoApp.executeMutation as (n: string, a: unknown) => Promise<unknown>)(name, args);
        },
        getMutationEntityTable: (name) => todoMutationEntityTable.get(name) ?? articleMutationEntityTable.get(name),
        commit: commitMutation,
    });

    return Response.json({});
}
