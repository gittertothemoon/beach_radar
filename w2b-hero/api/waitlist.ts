import type { VercelRequest, VercelResponse } from "@vercel/node";
import waitlistIndex from "./_handlers/waitlist-index";
import waitlistCount from "./_handlers/waitlist-count";
import waitlistConfirm from "./_handlers/waitlist-confirm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action;
    if (action === "count") return waitlistCount(req, res);
    if (action === "confirm") return waitlistConfirm(req, res);
    return waitlistIndex(req, res);
}
