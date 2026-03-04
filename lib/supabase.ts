import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Public client — for client-side use only
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side admin client — uses service role key (never exposed to browser)
// Used for server-side storage uploads bypassing RLS
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey,
  { auth: { persistSession: false } }
)
