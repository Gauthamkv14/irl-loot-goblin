import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Check if credentials exist and are not unconfigured placeholders
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabaseUrl.includes('YOUR_PROJECT_REF') &&
  !supabasePublishableKey.includes('YOUR_SUPABASE_PUBLISHABLE_KEY')
);

// If configured, instantiate standard Supabase client.
// If unconfigured, provide null so the UI can gracefully fallback to public guest appraisal.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
