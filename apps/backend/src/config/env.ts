import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/nivasa_dev?schema=public'),
  JWT_SECRET: z.string().default('nivasa-dev-secret-key-do-not-use-in-prod'),
  DEV_OTP_ENABLED: z.coerce.boolean().default(true),
  DEV_OTP_DEFAULT_CODE: z.string().default('123456'),
});

export const env = envSchema.parse(process.env);

