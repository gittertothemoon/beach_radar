import type { VercelRequest, VercelResponse } from "@vercel/node";
import analyticsIndex from "./_handlers/analytics-index.js";
import beachEnrichRun from "./_handlers/beach-enrich-run.js";
import legalConfigIndex from "./_handlers/legal-config-index.js";
import reportsConfirm from "./_handlers/reports-confirm.js";
import reportsIndex from "./_handlers/reports-index.js";
import reportsPrune from "./_handlers/reports-prune.js";

const readAction = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = readAction(req.query.action);
  if (action === "prune") return reportsPrune(req, res);
  if (action === "analytics") return analyticsIndex(req, res);
  if (action === "legal-config") return legalConfigIndex(req, res);
  if (action === "beach-enrich-run") return beachEnrichRun(req, res);
  if (action === "confirm") return reportsConfirm(req, res);
  return reportsIndex(req, res);
}
