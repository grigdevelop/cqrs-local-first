'use client';

import { AuthShell, ApplicationShell, type Credentials } from 'features';
import { useEffect, useState } from 'react';

type SessionUser = {
    id: string;
    email: string;
    created_at: string;
};

async function readJson<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
}

export default function TodosPageClient() {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
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

    async function handleAuthSubmit(mode: 'login' | 'register', body: Credentials) {
        setError(null);
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
            <AuthShell
                mounted={mounted}
                error={error}
                onLogin={(credentials) => handleAuthSubmit('login', credentials)}
                onRegister={(credentials) => handleAuthSubmit('register', credentials)}
            />
        );
    }

    return (
        <>
            {error ? (
                <main className="mx-auto w-full max-w-6xl px-4 pt-8">
                    <div className="alert alert-error alert-soft text-sm">
                        <span>{error}</span>
                    </div>
                </main>
            ) : null}
            <ApplicationShell
                user={user}
                actions={
                    <>
                        <div className="avatar avatar-placeholder">
                            <div className="bg-primary text-primary-content w-10 rounded-full">
                                <span>{user.email.slice(0, 1).toUpperCase()}</span>
                            </div>
                        </div>
                        <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="btn btn-ghost btn-sm">
                            {loggingOut ? <span className="loading loading-spinner loading-xs" /> : null}
                            Sign out
                        </button>
                    </>
                }
            />
        </>
    );
}
