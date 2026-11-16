import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RUSHTAXI - Gestión de flota con despacho, GPS y pagos",
  description: "Plataforma para radio taxis: carga de pedidos por la operadora, grilla de móviles, asignación con alarma al chófer, GPS en tiempo real, historial y pagos.",
  keywords: ["RUSHTAXI", "flota", "taxis", "despacho", "GPS", "móviles"],
  authors: [{ name: "RUSHTAXI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "RUSHTAXI - Sistema de gestión de flota",
    description: "Despacho de pedidos, grilla de móviles, GPS en vivo y pagos",
    siteName: "RUSHTAXI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
