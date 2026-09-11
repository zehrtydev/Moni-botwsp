import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

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
    <html lang="es">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
