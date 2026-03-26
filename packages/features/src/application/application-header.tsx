import type { ReactNode } from 'react';
import type { UserProfile } from '../modules/profile';

type ApplicationHeaderProps = {
    user: UserProfile;
    actions?: ReactNode;
};

export function ApplicationHeader({ user, actions }: ApplicationHeaderProps) {
    return (
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
    );
}
