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
  title: "VortexMessenger",
  description: "Real-time messaging app",
  icons: {
    icon: [
      { url: "/logo (1).ico", type: "image/x-icon" },
    ],
    shortcut: "/logo (1).ico",
    apple: "/logo (1).ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0e1621",
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
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0e1621] text-white overflow-hidden h-screen flex flex-col`}>
        <div className="flex-1 overflow-hidden relative">
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
