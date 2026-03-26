import type { VercelRequest, VercelResponse } from "@vercel/node";
import beachEnrichRun from "../_handlers/beach-enrich-run.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return beachEnrichRun(req, res);
}
