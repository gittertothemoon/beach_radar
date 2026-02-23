import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const REVIEWS_TABLE = "beach_reviews";
const MAX_BODY_BYTES = 8 * 1024;

function readEnv(name: string): string | null {
    const raw = process.env[name];
    if (!raw) return null;
    const trimmed = raw.trim();
    if (
        (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function buildSupabaseClient() {
    const supabaseUrl = readEnv("SUPABASE_URL");
    const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return null;
    return createClient(supabaseUrl, serviceRole, {
        auth: { persistSession: false },
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
    /* Currently handling everything through direct Supabase calls in src/lib/reviews.ts 
       so we don't strictly need this endpoint unless we want server-side caching 
       or custom validations. Leaving it returning 405 for now to use Supabase JS directly */
}
