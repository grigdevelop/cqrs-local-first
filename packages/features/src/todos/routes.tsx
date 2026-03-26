'use client';

import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { TodoApp, type TodoFilter } from './component';

const views: Array<{ filter: TodoFilter; href: string; label: string }> = [
    { filter: 'all', href: '/', label: 'All' },
    { filter: 'active', href: '/active', label: 'Active' },
    { filter: 'completed', href: '/completed', label: 'Completed' },
];

function TodoRouteLayout() {
    return (
        <main className="mx-auto mt-16 max-w-lg px-4">
            <header className="mb-8">
                <h1 className="text-3xl font-bold">Todos</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Switch between all, active, and completed todos without leaving the feature shell.
                </p>
            </header>

            <nav className="mb-6 flex gap-2" aria-label="Todo views">
                {views.map((view) => (
                    <NavLink
                        key={view.filter}
                        to={view.href}
                        end={view.href === '/'}
                        className={({ isActive }) =>
                            [
                                'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                isActive ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 hover:border-blue-400',
                            ].join(' ')
                        }
                    >
                        {view.label}
                    </NavLink>
                ))}
            </nav>

            <Outlet />
        </main>
    );
}

export function TodoRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<TodoRouteLayout />}>
                    <Route index element={<TodoApp filter="all" />} />
                    <Route path="active" element={<TodoApp filter="active" />} />
                    <Route path="completed" element={<TodoApp filter="completed" />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
