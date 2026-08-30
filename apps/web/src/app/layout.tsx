import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moni — Registro de gastos",
  description: "Registro de gastos por WhatsApp",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/moni-192.svg", type: "image/svg+xml" },
      { url: "/icons/moni-512.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/moni-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#7564e9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body><PwaRegister />{children}</body>
    </html>
  );
}
