'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, MemoryRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ArticleModuleShell } from '../modules/articles';
import { ProfileModuleShell, type UserProfile } from '../modules/profile';
import { TodoModuleShell } from '../modules/todos';
import { ApplicationReplicacheProvider } from './replicache-provider';

type ApplicationShellProps = {
    user: UserProfile;
    actions?: ReactNode;
};

const primaryNavigationItems = [
    { id: 'todos', href: '/todos', label: 'Todos' },
    { id: 'articles', href: '/articles', label: 'Articles' },
    { id: 'profile', href: '/profile', label: 'Profile' },
] as const;

type ApplicationFrameProps = {
    user: UserProfile;
    actions?: ReactNode;
    useRouterLinks?: boolean;
    children?: ReactNode;
};

function ApplicationFrame({ user, actions, useRouterLinks = true, children }: ApplicationFrameProps) {
    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
            <header className="navbar mb-6 rounded-box border border-base-300 bg-base-100/90 px-4 shadow-lg backdrop-blur">
                <div className="flex-1">
                    <div>
                        <p className="text-lg font-bold">Local First Workspace</p>
                        <p className="text-sm text-base-content/70">Todos, articles, and profile modules in one shell.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium">{user.email}</p>
                        <p className="text-xs text-base-content/60">Session active</p>
                    </div>
                    {actions}
                </div>
            </header>

            <nav className="tabs tabs-box mb-6 w-fit bg-base-100 p-1 shadow-md" aria-label="Application modules">
                {primaryNavigationItems.map((module) => (
                    useRouterLinks ? (
                        <NavLink
                            key={module.id}
                            to={module.href}
                            className={({ isActive }) => `tab rounded-lg px-5 ${isActive ? 'tab-active bg-primary text-primary-content' : ''}`}
                        >
                            {module.label}
                        </NavLink>
                    ) : (
                        <span
                            key={module.id}
                            className={`tab rounded-lg px-5 ${module.id === 'todos' ? 'tab-active bg-primary text-primary-content' : ''}`}
                        >
                            {module.label}
                        </span>
                    )
                ))}
            </nav>

            {children}
        </main>
    );
}

function RoutedApplicationFrame({ user, actions }: { user: UserProfile; actions?: ReactNode }) {
    return (
        <ApplicationFrame user={user} actions={actions}>
            <Outlet />
        </ApplicationFrame>
    );
}

export function ApplicationShell({ user, actions }: ApplicationShellProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <ApplicationReplicacheProvider>
            {!mounted ? (
                <ApplicationFrame user={user} actions={actions} useRouterLinks={false}>
                    <MemoryRouter initialEntries={['/']}>
                        <TodoModuleShell />
                    </MemoryRouter>
                </ApplicationFrame>
            ) : (
                <HashRouter>
                    <Routes>
                        <Route element={<RoutedApplicationFrame user={user} actions={actions} />}>
                            <Route index element={<Navigate to="/todos" replace />} />
                            <Route path="/todos/*" element={<TodoModuleShell />} />
                            <Route path="/articles/*" element={<ArticleModuleShell />} />
                            <Route path="/profile/*" element={<ProfileModuleShell profile={user} />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/todos" replace />} />
                    </Routes>
                </HashRouter>
            )}
        </ApplicationReplicacheProvider>
    );
}
