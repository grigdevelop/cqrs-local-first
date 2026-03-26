import { NextResponse } from 'next/server';
import { db } from '@/db/database';
import { CredentialsSchema } from '@/auth/credentials';
import { getAuthCookieName, getAuthCookieOptions, hashPassword, signJwt } from '@/auth/jwt';

export async function POST(req: Request) {
    const payload = CredentialsSchema.safeParse(await req.json());
    if (!payload.success) {
        return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    const { email, password } = payload.data;
    const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirst();
    if (existingUser) {
        return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
    }

    const user = {
        id: crypto.randomUUID(),
        email,
        password_hash: hashPassword(password),
        created_at: new Date().toISOString(),
    };

    await db.insertInto('users').values(user).execute();

    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    response.cookies.set(getAuthCookieName(), signJwt(user), getAuthCookieOptions());
    return response;
}
