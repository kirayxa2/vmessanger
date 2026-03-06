import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vortex Messenger",
  description: "Next-Gen Real-time Messaging",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vortex",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo (1).ico", type: "image/x-icon" },
    ],
    shortcut: "/logo (1).ico",
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1c242f",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <head>
        <link rel="icon" href="/logo (1).ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/logo (1).ico" type="image/x-icon" />
        {/* Фикс клавиатуры Android WebView: пересчитываем --vh при resize */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            function setVh() {
              var vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
              document.documentElement.style.setProperty('--vh', vh + 'px');
              document.documentElement.style.setProperty('--app-height', (window.visualViewport ? window.visualViewport.height : window.innerHeight) + 'px');
            }
            setVh();
            if (window.visualViewport) {
              window.visualViewport.addEventListener('resize', setVh);
              window.visualViewport.addEventListener('scroll', setVh);
            }
            window.addEventListener('resize', setVh);
          })();
        ` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0e1621] text-white overflow-hidden flex flex-col`}
        style={{ height: 'var(--app-height, 100dvh)' }}>
        <div className="flex-1 overflow-hidden relative" style={{ height: 'var(--app-height, 100dvh)' }}>
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
