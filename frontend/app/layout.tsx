import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CRANE CTRL — IoT Dashboard",
  description: "Real-time control and telemetry for autonomous tower crane",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans antialiased" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {/* TODO: Add ClerkProvider here once Clerk is configured */}
        {children}
      </body>
    </html>
  );
}
