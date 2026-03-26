import { createTodoModule } from 'features/todos';
import { db } from '@/db/database';

export const app = createTodoModule(db);
export type { TodoModuleApplication as Application } from 'features/todos';
