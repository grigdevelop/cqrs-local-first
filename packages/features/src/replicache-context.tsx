'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Replicache } from 'replicache';
import { featuresMutators, type FeaturesReplicache } from './application';

const ReplicacheContext = createContext<FeaturesReplicache | null>(null);

type FeaturesReplicacheProviderProps = {
    children: ReactNode;
};

export function FeaturesReplicacheProvider({ children }: FeaturesReplicacheProviderProps) {
    const [rep, setRep] = useState<FeaturesReplicache | null>(null);

    useEffect(() => {
        const instance = new Replicache({
            name: 'workspace',
            licenseKey: 'l123456789',
            pushURL: '/api/replicache/push',
            pullURL: '/api/replicache/pull',
            mutators: featuresMutators,
        });
        setRep(instance);
        return () => {
            void instance.close();
        };
    }, []);

    return <ReplicacheContext.Provider value={rep}>{children}</ReplicacheContext.Provider>;
}

export function useFeaturesReplicache() {
    return useContext(ReplicacheContext);
}
