import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Plan de Adquisiciones | ENDE Deoruro S.A.",
  description:
    "Sistema de Gestión de Expedientes de Adquisición de la Distribuidora de Electricidad ENDE Deoruro S.A. (Oruro - Bolivia)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background text-on-surface antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

