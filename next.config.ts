import type { NextConfig } from "next";
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Кэширование включено
});

const nextConfig: NextConfig = {
  images: {
    domains: ["taozobjhniqhjukwgmvn.supabase.co"],
    unoptimized: true,
  },
  
  // Твои заголовки безопасности (теперь они не сломают билд!)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `img-src 'self' data: blob: https://taozobjhniqhjukwgmvn.supabase.co`,
              "connect-src 'self' wss: ws: https://taozobjhniqhjukwgmvn.supabase.co https://vmessanger-production.up.railway.app",
              "media-src 'self' blob: https://taozobjhniqhjukwgmvn.supabase.co",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);