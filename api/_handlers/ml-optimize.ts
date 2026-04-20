import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyApiSecurityHeaders,
  readBearerToken,
  readEnv,
  safeEqualSecret,
} from "../_lib/security.js";
import {
  buildMlSupabaseClient,
  evaluatePredictionAccuracy,
  refreshActiveBeachPatterns,
} from "./ml-engine.js";

function isAuthorized(req: VercelRequest): boolean {
  const token = readBearerToken(req);
  if (!token) return false;
  const cronSecret = readEnv("CRON_SECRET");
  if (cronSecret) return safeEqualSecret(token, cronSecret);
  const mlToken = readEnv("ML_OPTIMIZE_TOKEN");
  if (!mlToken) return false;
  return safeEqualSecret(token, mlToken);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const supabase = buildMlSupabaseClient();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: "missing_env" });
  }

  const [accuracyEvaluated, patternsRefreshed] = await Promise.all([
    evaluatePredictionAccuracy(supabase),
    refreshActiveBeachPatterns(supabase),
  ]);

  return res.status(200).json({ ok: true, accuracyEvaluated, patternsRefreshed });
}
