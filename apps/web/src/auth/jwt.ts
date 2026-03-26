import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { AppDatabase, UserTable } from '@/db/schema';

const JWT_ALG = 'HS256';
const AUTH_COOKIE = 'auth_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type JwtPayload = {
    sub: string;
    email: string;
    exp: number;
};

export type AuthUser = Pick<UserTable, 'id' | 'email' | 'created_at'>;

function base64UrlEncode(input: string | Buffer) {
    return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string) {
    return Buffer.from(input, 'base64url').toString('utf8');
}

function getSecret() {
    return process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
}

export function getAuthCookieName() {
    return AUTH_COOKIE;
}

export function getAuthCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: TOKEN_TTL_SECONDS,
    };
}

export function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string) {
    const [salt, expectedHash] = encoded.split(':');
    if (!salt || !expectedHash) return false;
    const actualHash = scryptSync(password, salt, 64).toString('hex');
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signJwt(user: AuthUser) {
    const header = base64UrlEncode(JSON.stringify({ alg: JWT_ALG, typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        sub: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    } satisfies JwtPayload));
    const signature = createHmac('sha256', getSecret())
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const expected = createHmac('sha256', getSecret())
        .update(`${header}.${payload}`)
        .digest('base64url');
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
        return null;
    }

    const decoded = JSON.parse(base64UrlDecode(payload)) as JwtPayload;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
}

function readCookie(request: Request, name: string) {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;
    const cookie = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

export function getTokenFromRequest(request: Request) {
    return readCookie(request, AUTH_COOKIE);
}

export async function getAuthenticatedUser(db: AppDatabaseLike, request: Request): Promise<AuthUser | null> {
    const token = getTokenFromRequest(request);
    if (!token) return null;
    const payload = verifyJwt(token);
    if (!payload) return null;

    const user = await db
        .selectFrom('users')
        .select(['id', 'email', 'created_at'])
        .where('id', '=', payload.sub)
        .where('email', '=', payload.email)
        .executeTakeFirst();

    return user ?? null;
}

type AppDatabaseLike = {
    selectFrom: <T extends keyof AppDatabase>(table: T) => any;
};

export function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}
