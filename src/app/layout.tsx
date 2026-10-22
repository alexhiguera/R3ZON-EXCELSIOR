import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { htmlLang, project, siteUrl } from "@/config/project";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: project.name, template: `%s · ${project.name}` },
  description: project.description,
  applicationName: project.name,
  publisher: project.organization,
  creator: project.organization,
  openGraph: {
    siteName: project.name,
    locale: project.locale.replace("-", "_"),
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={htmlLang}>
      <body className="min-h-dvh antialiased">
        {children}
        {/*
         * Speed Insights: Web Vitals sin cookies ni identificadores. Solo envía
         * datos cuando la app corre en Vercel. Si la política de privacidad de
         * un producto lo trata como analítica sujeta a consentimiento, se mueve
         * detrás del banner (docs/STACK.md → Observabilidad).
         */}
        <SpeedInsights />
      </body>
    </html>
  );
}
