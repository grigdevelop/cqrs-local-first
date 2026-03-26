import { NextResponse } from 'next/server';
import { db } from '@/db/database';
import { getAuthenticatedUser } from '@/auth/jwt';

export async function GET(req: Request) {
    const user = await getAuthenticatedUser(db, req);
    return NextResponse.json({ user });
}
