'use client';

import type { Credentials } from '../model';
import { AuthFormCard } from './auth-form-card';

type LoginRouteProps = {
    error?: string | null;
    onSubmit: (credentials: Credentials) => Promise<void> | void;
};

export function LoginRoute({ error, onSubmit }: LoginRouteProps) {
    return <AuthFormCard mode="login" error={error} onSubmit={(_mode, credentials) => onSubmit(credentials)} />;
}
