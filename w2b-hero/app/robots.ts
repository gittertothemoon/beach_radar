import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/"],
    },
    sitemap: "https://where2beach.com/sitemap.xml",
    host: "https://where2beach.com",
  };
}
