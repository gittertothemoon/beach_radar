import type { VercelRequest, VercelResponse } from "@vercel/node";
import businessRequestIndex from "./_handlers/business-request-index.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return businessRequestIndex(req, res);
}

