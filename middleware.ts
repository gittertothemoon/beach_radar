import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function isStaticAsset(pathname: string) {
  if (STATIC_FILES.has(pathname)) return true;
  return STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAppPath(pathname: string) {
  return pathname === APP_PATH_PREFIX || pathname.startsWith(`${APP_PATH_PREFIX}/`);
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (isStaticAsset(pathname) || pathname.startsWith(API_PATH_PREFIX)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(WAITLIST_PATH, request.url));
  }

  if (pathname.startsWith("/waitlist") || pathname.startsWith(PRIVACY_PATH_PREFIX)) {
    return NextResponse.next();
  }

  if (isAppPath(pathname)) {
    const accessKey = process.env.APP_ACCESS_KEY ?? "";
    const cookieValue = request.cookies.get(ACCESS_COOKIE)?.value;
    const queryKey = searchParams.get(ACCESS_KEY_PARAM);
    const hasCookie = cookieValue === ACCESS_COOKIE_VALUE;
    const hasValidKey = accessKey.length > 0 && queryKey === accessKey;

    if (!hasCookie && !hasValidKey) {
      return NextResponse.redirect(new URL(WAITLIST_PATH, request.url));
    }

    if (hasValidKey && !hasCookie) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete(ACCESS_KEY_PARAM);
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set({
        name: ACCESS_COOKIE,
        value: ACCESS_COOKIE_VALUE,
        maxAge: 60 * 60 * 24 * 30,
        path: APP_PATH_PREFIX,
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      });
      return response;
    }

    return NextResponse.rewrite(new URL("/index.html", request.url));
  }

  return NextResponse.redirect(new URL(WAITLIST_PATH, request.url));
}

export const config = {
  matcher: "/:path*",
};
