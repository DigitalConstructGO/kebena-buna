import { z } from 'zod/v4';

export const loginSchema = z.object({
	email: z.email('Enter your email address'),
	password: z.string().min(1, 'Enter your password')
});
