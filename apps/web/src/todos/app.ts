import { createTodoApp } from 'features/todos';
import { db } from '@/db/database';

export const app = createTodoApp(db);
export type { TodoApplication as Application } from 'features/todos';
