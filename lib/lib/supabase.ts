import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Safe Supabase client:
 * - If env vars are missing, we return null so the app doesn't crash.
 * - API routes can decide to no-op or log locally.
 */
export function getSupabase() {
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false },
  });
}
