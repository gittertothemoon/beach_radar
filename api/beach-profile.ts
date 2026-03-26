import type { VercelRequest, VercelResponse } from "@vercel/node";
import beachProfileHandler from "./_handlers/beach-profile.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return beachProfileHandler(req, res);
}
