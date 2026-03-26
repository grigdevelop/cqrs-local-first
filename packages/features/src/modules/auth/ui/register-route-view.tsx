'use client';

import type { AuthRouteViewProps } from '../application';
import { AuthFormView } from './auth-form-view';

export function RegisterRouteView({ error, onSubmit }: AuthRouteViewProps) {
    return <AuthFormView mode="register" error={error} onSubmit={(_mode, credentials) => onSubmit(credentials)} />;
}
