import type { VercelRequest, VercelResponse } from "@vercel/node";
import signupIndex from "./_handlers/signup-index.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return signupIndex(req, res);
}
