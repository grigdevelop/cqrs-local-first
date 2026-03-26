'use client';

import { HashRouter, MemoryRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import type { AuthModuleShellProps } from '../application';
import { LoginRouteView } from './login-route-view';
import { RegisterRouteView } from './register-route-view';

function AuthHeroPanel() {
    return (
        <div className="card border border-primary/10 bg-primary text-primary-content shadow-2xl">
            <div className="card-body justify-between">
                <div className="space-y-4">
                    <div className="badge badge-outline border-primary-content/30 text-primary-content">Local-first stack</div>
                    <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Workspace Auth</h1>
                    <p className="max-w-md text-sm/6 text-primary-content/80">
                        Sign in to a synced workspace with articles, todos, and profile modules backed by Replicache, SQLite, and an HTTP-only JWT cookie.
                    </p>
                </div>

                <div className="stats stats-vertical bg-primary-content/10 text-primary-content shadow-none sm:stats-horizontal">
                    <div className="stat">
                        <div className="stat-title text-primary-content/70">Modules</div>
                        <div className="stat-value text-2xl">3</div>
                        <div className="stat-desc text-primary-content/70">Todos, articles, profile</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title text-primary-content/70">Sync</div>
                        <div className="stat-value text-2xl">Live</div>
                        <div className="stat-desc text-primary-content/70">Replicache pull/push protected</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AuthModuleScreen({ error, onLogin, onRegister }: Omit<AuthModuleShellProps, 'mounted'>) {
    return (
        <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
            <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <AuthHeroPanel />
                <section>
                    <div className="tabs tabs-box mb-2 bg-base-200 p-1">
                        <NavLink to="/register" end className={({ isActive }) => `tab flex-1 rounded-lg ${isActive ? 'tab-active bg-base-100 shadow-sm' : ''}`}>
                            Create account
                        </NavLink>
                        <NavLink to="/login" className={({ isActive }) => `tab flex-1 rounded-lg ${isActive ? 'tab-active bg-base-100 shadow-sm' : ''}`}>
                            Sign in
                        </NavLink>
                    </div>

                    <Routes>
                        <Route index element={<Navigate to="/register" replace />} />
                        <Route path="/register" element={<RegisterRouteView error={error} onSubmit={onRegister} />} />
                        <Route path="/login" element={<LoginRouteView error={error} onSubmit={onLogin} />} />
                        <Route path="*" element={<Navigate to="/register" replace />} />
                    </Routes>
                </section>
            </section>
        </main>
    );
}

export function AuthModuleShell({ error, mounted = true, onLogin, onRegister }: AuthModuleShellProps) {
    if (!mounted) {
        return (
            <MemoryRouter initialEntries={['/register']}>
                <AuthModuleScreen error={error} onLogin={onLogin} onRegister={onRegister} />
            </MemoryRouter>
        );
    }

    return (
        <HashRouter>
            <AuthModuleScreen error={error} onLogin={onLogin} onRegister={onRegister} />
        </HashRouter>
    );
}
