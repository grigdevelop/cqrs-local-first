'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { TodoModuleRoutes } from 'features/todos';
import { ProfileModuleView } from 'features/profile';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CredentialsSchema, type Credentials } from '@/auth/credentials';

type SessionUser = {
    id: string;
    email: string;
    created_at: string;
};

type AuthMode = 'login' | 'register';
type AppModule = 'todos' | 'profile';

async function readJson<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
}

export default function TodosPageClient() {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [mode, setMode] = useState<AuthMode>('register');
    const [activeModule, setActiveModule] = useState<AppModule>('todos');
    const [loading, setLoading] = useState(true);
    const [loggingOut, setLoggingOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<Credentials>({
        resolver: zodResolver(CredentialsSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    useEffect(() => {
        void fetch('/api/auth/session')
            .then((response) => readJson<{ user: SessionUser | null }>(response))
            .then((payload) => {
                setUser(payload.user);
                setLoading(false);
            })
            .catch(() => {
                setError('Could not load the current session.');
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        reset();
        setError(null);
    }, [mode, reset]);

    async function handleAuthSubmit(body: Credentials) {
        const response = await fetch(`/api/auth/${mode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const payload = await readJson<{ user?: SessionUser; error?: string }>(response);

        if (!response.ok || !payload.user) {
            setError(payload.error ?? 'Authentication failed.');
            return;
        }

        setUser(payload.user);
        setActiveModule('todos');
        reset();
    }

    async function handleLogout() {
        setLoggingOut(true);
        setError(null);

        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (!response.ok) {
            setError('Could not sign out.');
            setLoggingOut(false);
            return;
        }

        setUser(null);
        setLoggingOut(false);
    }

    if (loading) {
        return (
            <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
                <div className="card w-full max-w-md border border-base-300 bg-base-100 shadow-xl">
                    <div className="card-body items-center text-center">
                        <span className="loading loading-bars loading-lg text-primary" />
                        <p className="text-sm text-base-content/70">Loading session...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (!user) {
        return (
            <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
                <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="card border border-primary/10 bg-primary text-primary-content shadow-2xl">
                        <div className="card-body justify-between">
                            <div className="space-y-4">
                                <div className="badge badge-outline border-primary-content/30 text-primary-content">Local-first stack</div>
                                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">JWT Auth</h1>
                                <p className="max-w-md text-sm/6 text-primary-content/80">
                                    Sign in to a synced todo workspace backed by Replicache, SQLite, and a server-issued HTTP-only JWT cookie.
                                </p>
                            </div>

                            <div className="stats stats-vertical bg-primary-content/10 text-primary-content shadow-none sm:stats-horizontal">
                                <div className="stat">
                                    <div className="stat-title text-primary-content/70">Session</div>
                                    <div className="stat-value text-2xl">7d</div>
                                    <div className="stat-desc text-primary-content/70">JWT cookie lifetime</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title text-primary-content/70">Sync</div>
                                    <div className="stat-value text-2xl">Live</div>
                                    <div className="stat-desc text-primary-content/70">Replicache pull/push protected</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <section className="card border border-base-300 bg-base-100 shadow-2xl">
                        <div className="card-body">
                            <div className="mb-2">
                                <h2 className="card-title text-2xl">Access your workspace</h2>
                                <p className="text-sm text-base-content/70">Create an account or sign in with the same credentials.</p>
                            </div>

                            <div className="tabs tabs-box mb-2 bg-base-200 p-1">
                                {(['register', 'login'] as const).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => {
                                            setMode(value);
                                            setError(null);
                                        }}
                                        className={`tab flex-1 rounded-lg ${mode === value ? 'tab-active bg-base-100 shadow-sm' : ''}`}
                                    >
                                        {value === 'register' ? 'Create account' : 'Sign in'}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={(event) => void handleSubmit(handleAuthSubmit)(event)} className="space-y-4">
                                <label className="form-control w-full">
                                    <span className="label">
                                        <span className="label-text font-medium">Email</span>
                                    </span>
                                    <input
                                        {...register('email')}
                                        type="email"
                                        autoComplete="email"
                                        placeholder="Email"
                                        className="input input-bordered w-full"
                                    />
                                    {errors.email ? <span className="label-text-alt mt-2 text-error">{errors.email.message}</span> : null}
                                </label>
                                <label className="form-control w-full">
                                    <span className="label">
                                        <span className="label-text font-medium">Password</span>
                                    </span>
                                    <input
                                        {...register('password')}
                                        type="password"
                                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                        placeholder="Password"
                                        className="input input-bordered w-full"
                                    />
                                    {errors.password ? <span className="label-text-alt mt-2 text-error">{errors.password.message}</span> : null}
                                </label>

                                {error ? (
                                    <div className="alert alert-error alert-soft text-sm">
                                        <span>{error}</span>
                                    </div>
                                ) : null}

                                <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
                                    {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : null}
                                    {isSubmitting ? 'Working...' : mode === 'register' ? 'Create account' : 'Sign in'}
                                </button>
                            </form>
                        </div>
                    </section>
                </section>
            </main>
        );
    }

    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
            <header className="navbar mb-6 rounded-box border border-base-300 bg-base-100/90 px-4 shadow-lg backdrop-blur">
                <div className="flex-1">
                    <div>
                        <p className="text-lg font-bold">Local First Todos</p>
                        <p className="text-sm text-base-content/70">Authenticated with an HTTP-only JWT cookie.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium">{user.email}</p>
                        <p className="text-xs text-base-content/60">Session active</p>
                    </div>
                    <div className="avatar avatar-placeholder">
                        <div className="bg-primary text-primary-content w-10 rounded-full">
                            <span>{user.email.slice(0, 1).toUpperCase()}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleLogout()}
                        disabled={loggingOut}
                        className="btn btn-ghost btn-sm"
                    >
                        {loggingOut ? <span className="loading loading-spinner loading-xs" /> : null}
                        Sign out
                    </button>
                </div>
            </header>
            <nav className="tabs tabs-box mb-6 w-fit bg-base-100 p-1 shadow-md" aria-label="Application modules">
                <button
                    type="button"
                    onClick={() => setActiveModule('todos')}
                    className={`tab rounded-lg px-5 ${activeModule === 'todos' ? 'tab-active bg-primary text-primary-content' : ''}`}
                >
                    Todos
                </button>
                <button
                    type="button"
                    onClick={() => setActiveModule('profile')}
                    className={`tab rounded-lg px-5 ${activeModule === 'profile' ? 'tab-active bg-primary text-primary-content' : ''}`}
                >
                    Profile
                </button>
            </nav>
            {error ? (
                <div className="alert alert-error alert-soft mb-4 text-sm">
                    <span>{error}</span>
                </div>
            ) : null}
            {activeModule === 'todos' ? <TodoModuleRoutes /> : <ProfileModuleView profile={user} />}
        </main>
    );
}

