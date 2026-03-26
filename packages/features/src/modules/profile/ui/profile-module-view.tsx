'use client';

import type { UserProfile } from '../model/schema';

type ProfileModuleViewProps = {
    profile: UserProfile;
};

function formatJoinedDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Unknown'
        : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function ProfileModuleView({ profile }: ProfileModuleViewProps) {
    return (
        <section className="mx-auto w-full max-w-4xl">
            <header className="mb-6 rounded-box border border-base-300 bg-base-100/90 p-6 shadow-xl backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="badge badge-outline mb-3">Application module</div>
                        <h1 className="text-4xl font-black tracking-tight">Profile</h1>
                        <p className="mt-2 max-w-2xl text-sm text-base-content/70">
                            Account details for the authenticated user in the main application shell.
                        </p>
                    </div>
                    <div className="stats stats-horizontal border border-base-300 bg-base-200 shadow-none">
                        <div className="stat px-5 py-4">
                            <div className="stat-title">Identity</div>
                            <div className="stat-value text-lg">{profile.email}</div>
                        </div>
                        <div className="stat px-5 py-4">
                            <div className="stat-title">Joined</div>
                            <div className="stat-value text-lg">{formatJoinedDate(profile.created_at)}</div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="card border border-base-300 bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title">Profile Details</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-box bg-base-200 p-4">
                                <p className="text-xs uppercase tracking-wide text-base-content/50">Email</p>
                                <p className="mt-2 text-base font-medium">{profile.email}</p>
                            </div>
                            <div className="rounded-box bg-base-200 p-4">
                                <p className="text-xs uppercase tracking-wide text-base-content/50">User ID</p>
                                <p className="mt-2 break-all font-mono text-sm">{profile.id}</p>
                            </div>
                            <div className="rounded-box bg-base-200 p-4 sm:col-span-2">
                                <p className="text-xs uppercase tracking-wide text-base-content/50">Member Since</p>
                                <p className="mt-2 text-base font-medium">{formatJoinedDate(profile.created_at)}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="card border border-primary/10 bg-primary text-primary-content shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title">Session Notes</h2>
                        <ul className="space-y-3 text-sm text-primary-content/85">
                            <li>JWT authentication is handled with an HTTP-only cookie.</li>
                            <li>The profile module reads user data from the existing auth session endpoint.</li>
                            <li>Todos remain a separate module in the same application shell.</li>
                        </ul>
                    </div>
                </aside>
            </div>
        </section>
    );
}
