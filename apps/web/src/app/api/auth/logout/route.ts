import { NextResponse } from 'next/server';
import { getAuthCookieName } from '@/auth/jwt';

export async function POST() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAuthCookieName(), '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
    });
    return response;
}
