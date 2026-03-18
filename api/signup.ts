import type { VercelRequest, VercelResponse } from "@vercel/node";
import waitlistIndex from "./_handlers/waitlist-index.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return waitlistIndex(req, res);
}
