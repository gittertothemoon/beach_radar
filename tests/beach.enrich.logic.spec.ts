import { expect, test } from "@playwright/test";
import {
  computePublishConfidence,
  normalizePhone,
  normalizeServices,
  normalizeWebsite,
} from "../api/_lib/beach-enrichment";

test("normalize helpers sanitize website/phone/services", async () => {
  expect(normalizeWebsite("example.com/")).toBe("https://example.com");
  expect(normalizePhone("+39 (0541) 123 456")).toBe("+39 0541 123 456");
  expect(normalizeServices(["wifi", "docce", "pet friendly"]).sort()).toEqual(
    ["Docce", "Pet Friendly", "Wi-Fi"].sort(),
  );
});

test("confidence rule queues records with google-only sources", async () => {
  const result = computePublishConfidence({
    hasOfficialSource: false,
    hasGoogleSource: true,
    threshold: 0.85,
    review: {
      decision: "verified",
      conflictFlags: [],
      fieldScores: {},
      reviewerScore: 0.95,
    },
  });

  expect(result.decision).toBe("queue");
  expect(result.reason).toBe("official_source_missing");
  expect(result.confidence).toBeLessThan(0.85);
});

test("confidence rule allows publish on official+google agreement", async () => {
  const result = computePublishConfidence({
    hasOfficialSource: true,
    hasGoogleSource: true,
    threshold: 0.85,
    review: {
      decision: "verified",
      conflictFlags: [],
      fieldScores: {},
      reviewerScore: 0.9,
    },
  });

  expect(result.decision).toBe("publish");
  expect(result.confidence).toBeGreaterThanOrEqual(0.85);
});
