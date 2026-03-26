'use client';

import type { UserProfile } from '../model/schema';
import { ProfileModuleView } from './profile-module-view';

type ProfileModuleShellProps = {
    profile: UserProfile;
};

export function ProfileModuleShell({ profile }: ProfileModuleShellProps) {
    return <ProfileModuleView profile={profile} />;
}
