'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CredentialsSchema, type Credentials } from '../model';

export type AuthMode = 'login' | 'register';

type AuthFormCardProps = {
    mode: AuthMode;
    error?: string | null;
    onSubmit: (mode: AuthMode, credentials: Credentials) => Promise<void> | void;
};

export function AuthFormCard({ mode, error, onSubmit }: AuthFormCardProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<Credentials>({
        resolver: zodResolver(CredentialsSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    useEffect(() => {
        reset();
    }, [mode, reset]);

    return (
        <section className="card border border-base-300 bg-base-100 shadow-2xl">
            <div className="card-body">
                <div className="mb-2">
                    <h2 className="card-title text-2xl">Access your workspace</h2>
                    <p className="text-sm text-base-content/70">Create an account or sign in with the same credentials.</p>
                </div>

                <form onSubmit={(event) => void handleSubmit((values) => onSubmit(mode, values))(event)} className="space-y-4">
                    <label className="form-control w-full">
                        <span className="label">
                            <span className="label-text font-medium">Email</span>
                        </span>
                        <input {...register('email')} type="email" autoComplete="email" placeholder="Email" className="input input-bordered w-full" />
                        {errors.email ? <span className="label-text-alt mt-2 text-error">{errors.email.message}</span> : null}
                    </label>
                    <label className="form-control w-full">
                        <span className="label">
                            <span className="label-text font-medium">Password</span>
                        </span>
                        <input
                            {...register('password')}
                            type="password"
                            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                            placeholder="Password"
                            className="input input-bordered w-full"
                        />
                        {errors.password ? <span className="label-text-alt mt-2 text-error">{errors.password.message}</span> : null}
                    </label>

                    {error ? <div className="alert alert-error alert-soft text-sm"><span>{error}</span></div> : null}

                    <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
                        {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : null}
                        {isSubmitting ? 'Working...' : mode === 'register' ? 'Create account' : 'Sign in'}
                    </button>
                </form>
            </div>
        </section>
    );
}
