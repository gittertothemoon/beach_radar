import { STRINGS } from "../i18n/it";
import { formatStateLabel } from "../lib/format";
import type { BeachState, CrowdLevel } from "../lib/types";

export type ShareCardData = {
  name: string;
  region: string;
  crowdLevel: CrowdLevel;
  state: BeachState;
  confidence: string;
  updatedLabel: string;
  reportsCount: number;
};

const stateColor = (state: BeachState) => {
  switch (state) {
    case "LIVE":
      return "#22c55e";
    case "RECENT":
      return "#f59e0b";
    default:
      return "#64748b";
  }
};

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40);

const renderShareCard = async (data: ShareCardData) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  const drawRoundedRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0b1017");
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
  ctx.beginPath();
  ctx.arc(880, 420, 360, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
  ctx.beginPath();
  ctx.arc(200, 1400, 320, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "32px 'Space Grotesk', sans-serif";
  ctx.fillText(STRINGS.appName, 80, 140);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "72px 'Space Grotesk', sans-serif";
  ctx.fillText(data.name, 80, 260, 920);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "36px 'Space Grotesk', sans-serif";
  ctx.fillText(data.region, 80, 320, 920);

  const badgeY = 520;
  ctx.fillStyle = stateColor(data.state);
  drawRoundedRect(80, badgeY, 180, 80, 40);
  ctx.fill();

  ctx.fillStyle = "#0b1017";
  ctx.font = "48px 'Space Grotesk', sans-serif";
  ctx.fillText(`${data.crowdLevel}`, 140, badgeY + 58);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "40px 'Space Grotesk', sans-serif";
  ctx.fillText(formatStateLabel(data.state), 280, badgeY + 55);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "48px 'Space Grotesk', sans-serif";
  ctx.fillText(
    `${STRINGS.share.confidenceLabel}: ${data.confidence}`,
    80,
    700,
  );

  ctx.fillStyle = "#94a3b8";
  ctx.font = "36px 'Space Grotesk', sans-serif";
  ctx.fillText(
    `${STRINGS.share.updatedLabel}: ${data.updatedLabel}`,
    80,
    770,
  );
  const reportsLine =
    data.reportsCount > 0
      ? `${STRINGS.share.reportsLabel}: ${data.reportsCount}`
      : STRINGS.reports.noneRecent;
  ctx.fillText(reportsLine, 80, 830);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 100, 960, 1760);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export card"));
    }, "image/png");
  });
};

export const shareBeachCard = async (data: ShareCardData) => {
  const blob = await renderShareCard(data);
  const fileName = `beach-radar-${sanitizeFileName(data.name)}.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  const canShareFiles =
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    navigator.canShare?.({ files: [file] });

  if (navigator.share && canShareFiles) {
    await navigator.share({
      title: STRINGS.appName,
      text: STRINGS.share.shareText(data.name, data.confidence),
      files: [file],
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
