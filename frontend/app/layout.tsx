import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AppStateProvider } from "@/lib/state/app-state";
import { TopNav } from "@/components/top-nav";
import { AppBootstrap } from "@/components/app-bootstrap";
import { CelebrationToast, ErrorBanner, LoadingOverlay } from "@/components/feedback";

const heading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"]
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Pokemon TCG Booster Lab",
  description: "Pack-opening simulator with persistent binder progression."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable}`}>
        <AppStateProvider>
          <AppBootstrap />
          <div className="app-shell">
            <TopNav />
            <ErrorBanner />
            {children}
          </div>
          <LoadingOverlay />
          <CelebrationToast />
        </AppStateProvider>
      </body>
    </html>
  );
}
