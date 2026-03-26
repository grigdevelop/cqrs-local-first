import { createFeaturesApplication } from 'features';
import { db } from '@/db/database';

export function createUserFeaturesApp(userId: string) {
    return createFeaturesApplication(db, userId);
}

export type { FeaturesApplication as Application } from 'features';
