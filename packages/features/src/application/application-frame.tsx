import type { ReactNode } from 'react';
import type { UserProfile } from '../modules/profile';
import { ApplicationHeader } from './application-header';
import { ApplicationNavigation } from './application-navigation';

type ApplicationFrameProps = {
    user: UserProfile;
    actions?: ReactNode;
    useRouterLinks?: boolean;
    activeNavItem?: string;
    children?: ReactNode;
};

export function ApplicationFrame({
    user,
    actions,
    useRouterLinks = true,
    activeNavItem = 'todos',
    children,
}: ApplicationFrameProps) {
    return (
        <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
            <ApplicationHeader user={user} actions={actions} />
            <ApplicationNavigation useRouterLinks={useRouterLinks} activeItem={activeNavItem} />
            {children}
        </main>
    );
}
