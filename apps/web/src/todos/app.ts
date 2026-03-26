import { createTodoModule } from 'features/todos';
import { db } from '@/db/database';

export function createUserTodoApp(userId: string) {
    return createTodoModule(db, userId);
}

export type { TodoModuleApplication as Application } from 'features/todos';
