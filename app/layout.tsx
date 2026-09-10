import type { Metadata, Viewport } from "next";
import FloatingAiButton from "./components/FloatingAiButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeOS - Personal AI & Life Operating System",
  description: "Your AI-powered personal command center for tasks, documents, finances, and day planning.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LifeOS"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <FloatingAiButton />
      </body>
    </html>
  );
}
