import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const normalizeEnvValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\\n/g, "").trim();
};

const SUPABASE_URL = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = normalizeEnvValue(
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

let browserClient: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;

  browserClient = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
};
