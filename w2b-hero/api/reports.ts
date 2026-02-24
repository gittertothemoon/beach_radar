import type { VercelRequest, VercelResponse } from "@vercel/node";
import reportsIndex from "./_handlers/reports-index.js";
import reportsPrune from "./_handlers/reports-prune.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action;
    if (action === "prune") return reportsPrune(req, res);
    return reportsIndex(req, res);
}
