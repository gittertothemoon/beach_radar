import { STRINGS } from "../i18n/it";
import { track } from "../lib/analytics";
import { crowdLevelLabel } from "../lib/format";
import type { BeachState, CrowdLevel } from "../lib/types";
import logoUrl from "../assets/logo.png";
import wordmarkUrl from "../assets/beach-radar-scritta.png";
import shareBgUrl from "../assets/sharecard-bg.PNG";

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

const levelColor = (level: CrowdLevel) => {
  switch (level) {
    case 1:
      return "#22c55e";
    case 2:
      return "#facc15";
    case 3:
      return "#f97316";
    default:
      return "#ef4444";
  }
};

const toRgba = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40);

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const limited = lines.slice(0, maxLines);
  let last = limited[limited.length - 1];
  const ellipsis = "…";
  while (ctx.measureText(`${last}${ellipsis}`).width > maxWidth && last.length) {
    last = last.slice(0, -1);
  }
  limited[limited.length - 1] = `${last}${ellipsis}`;
  return limited;
};

const seedRandom = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

const renderShareCard = async (data: ShareCardData) => {
  const canvas = document.createElement("canvas");
  const dpr =
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  canvas.width = CANVAS_WIDTH * dpr;
  canvas.height = CANVAS_HEIGHT * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.scale(dpr, dpr);
  await document.fonts?.ready;

  const [logo, wordmark, shareBg] = await Promise.all([
    loadImage(logoUrl),
    loadImage(wordmarkUrl).catch(() => null),
    loadImage(shareBgUrl),
  ]);

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

  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;
  const padding = 48;
  const contentWidth = width - padding * 2;

  const scale = Math.max(width / shareBg.width, height / shareBg.height);
  const bgWidth = shareBg.width * scale;
  const bgHeight = shareBg.height * scale;
  const bgX = (width - bgWidth) / 2;
  const bgY = (height - bgHeight) / 2;
  ctx.drawImage(shareBg, bgX, bgY, bgWidth, bgHeight);

  const noiseSeed = seedRandom(12345);
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = 160;
  noiseCanvas.height = 160;
  const noiseCtx = noiseCanvas.getContext("2d");
  if (noiseCtx) {
    const imageData = noiseCtx.createImageData(160, 160);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.floor(noiseSeed() * 255);
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
      imageData.data[i + 3] = 18;
    }
    noiseCtx.putImageData(imageData, 0, 0);
    ctx.globalAlpha = 0.06;
    ctx.drawImage(noiseCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  const headerY = 60;
  const logoHeight = 490;
  const logoWidth = (logo.width / logo.height) * logoHeight;
  const centerX = width / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, centerX - logoWidth / 2, headerY, logoWidth, logoHeight);

  const wordmarkHeight = 281;
  const wordmarkY = headerY + logoHeight - 210;
  if (wordmark) {
    const scale = wordmarkHeight / wordmark.height;
    const wordmarkWidth = wordmark.width * scale;
    ctx.drawImage(
      wordmark,
      centerX - wordmarkWidth / 2,
      wordmarkY,
      wordmarkWidth,
      wordmarkHeight,
    );
  } else {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 281px 'Space Grotesk', sans-serif";
    const fallbackText = "BEACH RADAR";
    const fallbackWidth = ctx.measureText(fallbackText).width;
    ctx.fillText(fallbackText, centerX - fallbackWidth / 2, wordmarkY + 32);
  }

  const pillText = data.state === "PRED" ? "STIMA" : "LIVE";
  ctx.font = "700 26px 'Space Grotesk', sans-serif";
  const pillWidth = ctx.measureText(pillText).width + 36;
  const pillHeight = 44;
  const pillX = width - padding - pillWidth;
  const pillY = headerY + 10;
  const pillColor = stateColor(data.state);
  ctx.fillStyle = toRgba(pillColor, 0.18);
  drawRoundedRect(pillX, pillY, pillWidth, pillHeight, 22);
  ctx.fill();
  ctx.strokeStyle = toRgba(pillColor, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = pillColor;
  ctx.fillText(pillText, pillX + 18, pillY + 31);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 68px 'Space Grotesk', sans-serif";
  const titleLines = wrapText(ctx, data.name, contentWidth, 2);
  const titleY = 760;
  const titleLineHeight = 78;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, padding, titleY + index * titleLineHeight);
  });

  const regionY = titleY + titleLines.length * titleLineHeight + 18;
  ctx.fillStyle = "rgba(226, 232, 240, 0.94)";
  ctx.font = "500 35px 'Space Grotesk', sans-serif";
  ctx.fillText(data.region, padding, regionY);

  const statusY = regionY + 48;
  const statusHeight = 200;
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  drawRoundedRect(padding, statusY, contentWidth, statusHeight, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(226, 232, 240, 0.74)";
  ctx.font = "600 24px 'Space Grotesk', sans-serif";
  ctx.fillText(
    STRINGS.labels.crowdStatus.toUpperCase(),
    padding + 28,
    statusY + 56,
  );

  const crowdLabel = crowdLevelLabel(data.crowdLevel) || STRINGS.labels.crowd;
  ctx.fillStyle = levelColor(data.crowdLevel);
  ctx.font = "700 58px 'Space Grotesk', sans-serif";
  ctx.fillText(crowdLabel.toUpperCase(), padding + 28, statusY + 130, contentWidth - 56);

  const metaY = statusY + statusHeight + 56;
  ctx.fillStyle = "rgba(226, 232, 240, 0.94)";
  ctx.font = "500 36px 'Space Grotesk', sans-serif";
  const metaLines: string[] = [];
  if (data.confidence) {
    metaLines.push(`${STRINGS.share.confidenceLabel}: ${data.confidence}`);
  }
  if (data.updatedLabel) {
    metaLines.push(`${STRINGS.share.updatedLabel}: ${data.updatedLabel}`);
  }
  if (data.reportsCount > 0) {
    metaLines.push(`${STRINGS.share.reportsLabel}: ${data.reportsCount}`);
  } else {
    metaLines.push(STRINGS.reports.noneRecent);
  }
  metaLines.forEach((line, index) => {
    ctx.fillText(line, padding, metaY + index * 48);
  });

  const footerHeight = 132;
  const footerY = height - padding - footerHeight;
  ctx.fillStyle = "rgba(12, 18, 30, 0.82)";
  drawRoundedRect(padding, footerY, contentWidth, footerHeight, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
  ctx.font = "500 26px 'Space Grotesk', sans-serif";
  ctx.fillText("Apri questa spiaggia su", padding + 20, footerY + 48);

  ctx.fillStyle = "rgba(226, 232, 240, 0.96)";
  ctx.font = "600 26px 'Space Grotesk', sans-serif";
  ctx.fillText("beach-radar.vercel.app", padding + 20, footerY + 88);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export card"));
    }, "image/png");
  });
};

export const shareBeachCard = async (data: ShareCardData) => {
  track("share_card_generate");
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

  track("share_card_download");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
