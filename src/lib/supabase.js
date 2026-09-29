import { createClient } from '@supabase/supabase-js'

// Filled in from the .env file (see .env.example). The publishable/anon key is
// safe to ship in the app — the database security rules protect the data.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Treat the template placeholders from .env.example as "not configured".
export const isSupabaseConfigured = Boolean(
  url && key && !url.includes('your-project-id') && !key.startsWith('your-'),
)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
