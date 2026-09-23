import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { envSchema } from './schema.js';
import { generatePaths } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Load .env file from the backend root
dotenv.config({ path: join(__dirname, '../../.env') });

// 2. Validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

const env = parsedEnv.data;

if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || env.JWT_SECRET === 'development-secret-key-do-not-use-in-prod')) {
  console.error('❌ JWT_SECRET must be set to a unique value in production.');
  process.exit(1);
}

// 3. Assemble unified configuration object
const config = {
  app: {
    name: env.APP_NAME,
    version: env.APP_VERSION,
    env: env.NODE_ENV,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
  },
  server: {
    port: env.PORT,
    host: env.HOST,
    apiPrefix: env.API_PREFIX,
  },
  security: {
    jwtSecret: env.JWT_SECRET,
  },
  logger: {
    level: env.LOG_LEVEL,
  },
  // 4. Dynamically generate and expose absolute paths
  paths: generatePaths(env.STORAGE_ROOT),
  
  // 5. Sync API configuration (Vercel primary, optional Render fallback — same Supabase)
  sync: {
    apiUrl: env.SYNC_API_URL,
    fallbackApiUrl: env.SYNC_API_FALLBACK_URL || '',
    deviceSecret: env.DEVICE_SECRET
  }
};

export default config;
