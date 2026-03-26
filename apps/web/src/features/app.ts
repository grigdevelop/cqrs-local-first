import { createFeaturesApp } from 'features';
import { db } from '@/db/database';

export function createUserFeaturesApp(userId: string) {
    return createFeaturesApp(db, userId);
}

export type { FeaturesApp as Application } from 'features';
