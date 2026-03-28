'use client';

import { TodoModuleView } from './todo-module-view';

export function TodoModuleShell() {
    return (
        <TodoModuleView filter="all" />
    );
}
