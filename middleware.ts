const ACCESS_COOKIE = "br_app_access";
const ACCESS_COOKIE_VALUE = "1";
const ACCESS_KEY_PARAM = "key";
const WAITLIST_PATH = "/waitlist/";
const APP_PATH_PREFIX = "/app";
const PRIVACY_PATH_PREFIX = "/privacy";
const API_PATH_PREFIX = "/api";

const STATIC_PATH_PREFIXES = [
  "/_next",
  "/_vercel",
  "/assets",
  "/icons",
  "/og",
  "/waitlist",
  "/privacy",
];

const STATIC_FILES = new Set([
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/vite.svg",
]);

function nextResponse() {
  return new Response(null, { headers: { "x-middleware-next": "1" } });
}

function rewriteResponse(url: URL) {
  return new Response(null, { headers: { "x-middleware-rewrite": url.toString() } });
}

function redirectResponse(url: URL) {
  return Response.redirect(url.toString(), 302);
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function buildCookie(value: string) {
  return [
    `${ACCESS_COOKIE}=${encodeURIComponent(value)}`,
    "Max-Age=2592000",
    `Path=${APP_PATH_PREFIX}`,
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ].join("; ");
}

function isStaticAsset(pathname: string) {
  if (STATIC_FILES.has(pathname)) return true;
  return STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAppPath(pathname: string) {
  return pathname === APP_PATH_PREFIX || pathname.startsWith(`${APP_PATH_PREFIX}/`);
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const { pathname, searchParams } = url;

  if (isStaticAsset(pathname) || pathname.startsWith(API_PATH_PREFIX)) {
    return nextResponse();
  }

  if (pathname === "/") {
    return redirectResponse(new URL(WAITLIST_PATH, request.url));
  }

  if (pathname.startsWith("/waitlist") || pathname.startsWith(PRIVACY_PATH_PREFIX)) {
    return nextResponse();
  }

  if (isAppPath(pathname)) {
    const accessKey = process.env.APP_ACCESS_KEY ?? "";
    const cookieValue = readCookie(request.headers.get("cookie"), ACCESS_COOKIE);
    const queryKey = searchParams.get(ACCESS_KEY_PARAM);
    const hasCookie = cookieValue === ACCESS_COOKIE_VALUE;
    const hasValidKey = accessKey.length > 0 && queryKey === accessKey;

    if (!hasCookie && !hasValidKey) {
      return redirectResponse(new URL(WAITLIST_PATH, request.url));
    }

    if (hasValidKey && !hasCookie) {
      const cleanUrl = new URL(request.url);
      cleanUrl.searchParams.delete(ACCESS_KEY_PARAM);
      const response = redirectResponse(cleanUrl);
      response.headers.append("Set-Cookie", buildCookie(ACCESS_COOKIE_VALUE));
      return response;
    }

    return rewriteResponse(new URL("/index.html", request.url));
  }

  return redirectResponse(new URL(WAITLIST_PATH, request.url));
}

export const config = {
  matcher: "/:path*",
};
