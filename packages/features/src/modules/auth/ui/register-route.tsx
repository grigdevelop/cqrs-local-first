'use client';

import type { Credentials } from '../model';
import { AuthFormCard } from './auth-form-card';

type RegisterRouteProps = {
    error?: string | null;
    onSubmit: (credentials: Credentials) => Promise<void> | void;
};

export function RegisterRoute({ error, onSubmit }: RegisterRouteProps) {
    return <AuthFormCard mode="register" error={error} onSubmit={(_mode, credentials) => onSubmit(credentials)} />;
}
