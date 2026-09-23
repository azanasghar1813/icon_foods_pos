import { createClient } from '@supabase/supabase-js';
import config from './index.js';

// Initialize Supabase Client using the Service Role Key for backend administration
// We use the Service Role Key to bypass RLS and perform sync operations directly on behalf of the POS
export const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
