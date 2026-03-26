'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Replicache } from 'replicache';
import { applicationMutators, type ApplicationReplicache } from './create-features-app';

const ApplicationReplicacheContext = createContext<ApplicationReplicache | null>(null);

type ApplicationReplicacheProviderProps = {
    children: ReactNode;
};

export function ApplicationReplicacheProvider({ children }: ApplicationReplicacheProviderProps) {
    const [replicache, setReplicache] = useState<ApplicationReplicache | null>(null);

    useEffect(() => {
        const replicacheInstance = new Replicache({
            name: 'workspace',
            licenseKey: 'l123456789',
            pushURL: '/api/replicache/push',
            pullURL: '/api/replicache/pull',
            mutators: applicationMutators,
        });
        setReplicache(replicacheInstance);
        return () => {
            void replicacheInstance.close();
        };
    }, []);

    return <ApplicationReplicacheContext.Provider value={replicache}>{children}</ApplicationReplicacheContext.Provider>;
}

export function useApplicationReplicache() {
    return useContext(ApplicationReplicacheContext);
}
