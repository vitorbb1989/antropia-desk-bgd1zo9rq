// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Read from runtime window.ENV (for Docker environments)
const SUPABASE_URL = (window as any).ENV?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_PUBLISHABLE_KEY = (window as any).ENV?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

// Validate required environment variables
if (!SUPABASE_URL || SUPABASE_URL === 'undefined') {
  throw new Error('VITE_SUPABASE_URL is required but not defined. Please check your environment variables.')
}
if (!SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY === 'undefined') {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required but not defined. Please check your environment variables.')
}

// Import the supabase client like this:
// import { supabase } from "@/lib/supabase/client";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
