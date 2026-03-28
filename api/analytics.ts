import type { VercelRequest, VercelResponse } from "@vercel/node";
import analyticsIndex from "./_handlers/analytics-index.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return analyticsIndex(req, res);
}
