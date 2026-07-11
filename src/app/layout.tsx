import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rivaliza",
  description: "Missões, jogos, ranking e recompensas — gamificação com economia virtual segura.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rivaliza",
  },
};

export const viewport: Viewport = {
  themeColor: "#070712",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-dvh antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
