'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { TodoModuleView, type TodoFilter } from './todo-module-view';

const views: Array<{ filter: TodoFilter; href: string; label: string }> = [
    { filter: 'all', href: '/', label: 'All' },
    { filter: 'active', href: '/active', label: 'Active' },
    { filter: 'completed', href: '/completed', label: 'Completed' },
];

type TodoModuleLayoutProps = {
    children?: ReactNode;
    useRouterLinks?: boolean;
};

function TodoModuleLayout({ children, useRouterLinks = true }: TodoModuleLayoutProps) {
    return (
        <section className="mx-auto w-full max-w-4xl">
            <header className="mb-6 rounded-box border border-base-300 bg-base-100/90 p-6 shadow-xl backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="badge badge-outline mb-3">Application module</div>
                        <h1 className="text-4xl font-black tracking-tight">Todos</h1>
                        <p className="mt-2 max-w-2xl text-sm text-base-content/70">
                            Todo management is one module inside the main application shell.
                        </p>
                    </div>
                    <div className="stats stats-horizontal border border-base-300 bg-base-200 shadow-none">
                        <div className="stat px-5 py-4">
                            <div className="stat-title">Views</div>
                            <div className="stat-value text-2xl">3</div>
                        </div>
                        <div className="stat px-5 py-4">
                            <div className="stat-title">Module</div>
                            <div className="stat-value text-2xl">Todos</div>
                        </div>
                    </div>
                </div>
            </header>

            <nav className="tabs tabs-box mb-6 w-fit bg-base-100 p-1 shadow-md" aria-label="Todo views">
                {views.map((view) => (
                    useRouterLinks ? (
                        <NavLink
                            key={view.filter}
                            to={view.href}
                            end={view.href === '/'}
                            className={({ isActive }) => `tab rounded-lg px-5 ${isActive ? 'tab-active bg-primary text-primary-content' : ''}`}
                        >
                            {view.label}
                        </NavLink>
                    ) : (
                        <span
                            key={view.filter}
                            className={`tab rounded-lg px-5 ${view.filter === 'all' ? 'tab-active bg-primary text-primary-content' : ''}`}
                        >
                            {view.label}
                        </span>
                    )
                ))}
            </nav>

            <section className="rounded-box border border-base-300 bg-base-100/95 p-6 shadow-xl backdrop-blur">
                {children ?? <Outlet />}
            </section>
        </section>
    );
}

export function TodoModuleRoutes() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <TodoModuleLayout useRouterLinks={false}>
                <TodoModuleView filter="all" />
            </TodoModuleLayout>
        );
    }

    return (
        <HashRouter>
            <Routes>
                <Route element={<TodoModuleLayout />}>
                    <Route index element={<TodoModuleView filter="all" />} />
                    <Route path="active" element={<TodoModuleView filter="active" />} />
                    <Route path="completed" element={<TodoModuleView filter="completed" />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </HashRouter>
    );
}
