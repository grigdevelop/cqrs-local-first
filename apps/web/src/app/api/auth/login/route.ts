import { NextResponse } from 'next/server';
import { db } from '@/db/database';
import { CredentialsSchema } from '@/auth/credentials';
import { getAuthCookieName, getAuthCookieOptions, signJwt, verifyPassword } from '@/auth/jwt';

export async function POST(req: Request) {
    const payload = CredentialsSchema.safeParse(await req.json());
    if (!payload.success) {
        return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const { email, password } = payload.data;
    const user = await db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst();
    if (!user || !verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    response.cookies.set(getAuthCookieName(), signJwt(user), getAuthCookieOptions());
    return response;
}
