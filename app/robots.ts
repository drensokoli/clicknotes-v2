import type { MetadataRoute } from "next"

const SITE_URL = "https://www.clicknotes.site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/library",
        "/saved",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/verification-pending",
        "/retry-population",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
