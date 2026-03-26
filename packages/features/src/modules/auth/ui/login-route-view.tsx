'use client';

import type { AuthRouteViewProps } from '../application';
import { AuthFormView } from './auth-form-view';

export function LoginRouteView({ error, onSubmit }: AuthRouteViewProps) {
    return <AuthFormView mode="login" error={error} onSubmit={(_mode, credentials) => onSubmit(credentials)} />;
}
