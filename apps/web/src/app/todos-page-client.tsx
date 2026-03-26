'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { TodoRouter } from 'features/todos';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CredentialsSchema, type Credentials } from '@/auth/credentials';

type SessionUser = {
    id: string;
    email: string;
};

type AuthMode = 'login' | 'register';

async function readJson<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
}

export default function TodosPageClient() {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [mode, setMode] = useState<AuthMode>('register');
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
        return <main className="mx-auto mt-16 max-w-lg px-4 text-sm text-gray-500">Loading session...</main>;
    }

    if (!user) {
        return (
            <main className="mx-auto mt-16 max-w-lg px-4">
                <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                    <h1 className="text-3xl font-bold">JWT Auth</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Create an account or sign in to access the synced todo app.
                    </p>

                    <div className="mt-6 flex gap-2">
                        {(['register', 'login'] as const).map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => {
                                    setMode(value);
                                    setError(null);
                                }}
                                className={[
                                    'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                    mode === value ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-gray-600',
                                ].join(' ')}
                            >
                                {value === 'register' ? 'Create account' : 'Sign in'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={(event) => void handleSubmit(handleAuthSubmit)(event)} className="mt-6 space-y-4">
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium">Email</span>
                            <input
                                {...register('email')}
                                type="email"
                                autoComplete="email"
                                placeholder="Email"
                                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email.message}</p> : null}
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-medium">Password</span>
                            <input
                                {...register('password')}
                                type="password"
                                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                                placeholder="Password"
                                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password.message}</p> : null}
                        </label>

                        {error ? <p className="text-sm text-red-600">{error}</p> : null}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg bg-blue-500 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
                        >
                            {isSubmitting ? 'Working...' : mode === 'register' ? 'Create account' : 'Sign in'}
                        </button>
                    </form>
                </section>
            </main>
        );
    }

    return (
        <>
            <header className="mx-auto mt-8 flex w-full max-w-lg items-center justify-between px-4">
                <div>
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    <p className="text-xs text-gray-500">Authenticated with an HTTP-only JWT cookie.</p>
                </div>
                <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={loggingOut}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                    Sign out
                </button>
            </header>
            {error ? <p className="mx-auto mt-4 max-w-lg px-4 text-sm text-red-600">{error}</p> : null}
            <TodoRouter />
        </>
    );
}
