import type { VercelRequest, VercelResponse } from "@vercel/node";
import reportsPrune from "./_handlers/reports-prune.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    return reportsPrune(req, res);
}
