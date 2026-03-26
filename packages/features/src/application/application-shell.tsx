'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ArticleModuleShell } from '../modules/articles';
import { ProfileModuleShell, type UserProfile } from '../modules/profile';
import { TodoModuleShell } from '../modules/todos';
import { ApplicationFrame } from './application-frame';
import { ApplicationReplicacheProvider } from './replicache-provider';

type ApplicationShellProps = {
    user: UserProfile;
    actions?: ReactNode;
};

function RoutedApplicationFrame({ user, actions }: { user: UserProfile; actions?: ReactNode }) {
    return (
        <ApplicationFrame user={user} actions={actions}>
            <Outlet />
        </ApplicationFrame>
    );
}

function useMounted() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return mounted;
}

export function ApplicationShell({ user, actions }: ApplicationShellProps) {
    const mounted = useMounted();

    if (!mounted) {
        return null;
    }

    return (
        <ApplicationReplicacheProvider>
            <HashRouter>
                <Routes>
                    <Route element={<RoutedApplicationFrame user={user} actions={actions} />}>
                        <Route index element={<Navigate to="/todos" replace />} />
                        <Route path="/todos/*" element={<TodoModuleShell />} />
                        <Route path="/articles/*" element={<ArticleModuleShell />} />
                        <Route path="/profile/*" element={<ProfileModuleShell profile={user} />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/todos" replace />} />
                </Routes>
            </HashRouter>
        </ApplicationReplicacheProvider>
    );
}
