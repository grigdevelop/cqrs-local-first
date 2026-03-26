import { z } from 'zod';
import { normalizeEmail } from './jwt';

export const CredentialsSchema = z.object({
    email: z.string().email().transform(normalizeEmail),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
