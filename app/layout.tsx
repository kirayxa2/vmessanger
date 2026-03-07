import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";
import { ThemeProvider } from "@/lib/theme";

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
        {/* Фикс клавиатуры Android WebView */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var isAndroid = /Android/i.test(navigator.userAgent);
            
            function applyHeight(h) {
              var r = document.documentElement;
              r.style.setProperty('--vh', (h * 0.01) + 'px');
              r.style.setProperty('--app-height', h + 'px');
              // Для мобильного layout — двигаем контейнер чата
              var chatWrap = document.getElementById('mobile-chat-wrap');
              if (chatWrap) chatWrap.style.height = h + 'px';
            }

            function getH() {
              return window.visualViewport ? window.visualViewport.height : window.innerHeight;
            }

            applyHeight(getH());

            if (window.visualViewport) {
              // visualViewport — самый точный источник высоты с учётом клавиатуры
              window.visualViewport.addEventListener('resize', function() {
                applyHeight(window.visualViewport.height);
              });
              window.visualViewport.addEventListener('scroll', function() {
                applyHeight(window.visualViewport.height);
              });
            }
            // Fallback для браузеров без visualViewport
            window.addEventListener('resize', function() {
              applyHeight(getH());
            });

            // Дополнительный polling для Android WebView который иногда не тригерит visualViewport
            // Проверяем через 100мс после фокуса на любом input
            document.addEventListener('focusin', function(e) {
              if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                var checks = [100, 300, 500, 800];
                checks.forEach(function(ms) {
                  setTimeout(function() { applyHeight(getH()); }, ms);
                });
              }
            });
            document.addEventListener('focusout', function(e) {
              if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                setTimeout(function() { applyHeight(getH()); }, 200);
              }
            });
          })();
        ` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0e1621] text-white`}
        style={{ height: 'var(--app-height, 100dvh)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-1 relative" style={{ height: 'var(--app-height, 100dvh)', overflow: 'hidden' }}>
          <ThemeProvider>
            <ClientProviders>{children}</ClientProviders>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
