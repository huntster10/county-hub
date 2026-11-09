import type { NextConfig } from "next";

/**
 * Next.js configuration.
 *
 * We intentionally keep the "classic" rendering model (no Cache Components)
 * because almost every page in this app is personalised and reads the
 * logged-in user's session cookie. That makes the mental model simple:
 * server components run on every request and always see fresh data.
 */
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      // Roblox avatar thumbnails
      { protocol: "https", hostname: "tr.rbxcdn.com" },
      { protocol: "https", hostname: "*.rbxcdn.com" },
      // Supabase storage (chat attachments)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
