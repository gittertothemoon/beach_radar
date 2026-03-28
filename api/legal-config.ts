import type { VercelRequest, VercelResponse } from "@vercel/node";
import legalConfigIndex from "./_handlers/legal-config-index.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  return legalConfigIndex(req, res);
}
