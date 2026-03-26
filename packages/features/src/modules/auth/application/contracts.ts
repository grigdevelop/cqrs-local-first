import type { Credentials } from '../model';

export type AuthMode = 'login' | 'register';

export type AuthRouteViewProps = {
    error?: string | null;
    onSubmit: (credentials: Credentials) => Promise<void> | void;
};

export type AuthModuleShellProps = {
    error?: string | null;
    mounted?: boolean;
    onLogin: (credentials: Credentials) => Promise<void> | void;
    onRegister: (credentials: Credentials) => Promise<void> | void;
};
