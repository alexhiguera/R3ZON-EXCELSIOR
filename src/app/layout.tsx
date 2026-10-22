import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import type { ReactNode } from "react";
import { htmlLang, project, siteUrl } from "@/config/project";
import "./globals.css";

/*
 * Las tipografías de r3zon.com (Inter para el texto, Sora para los títulos).
 * next/font las descarga en el build y las sirve desde nuestro dominio: el
 * navegador del cliente no llama a Google (privacidad y CSP).
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#05010f",
  colorScheme: "dark",
};

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
    <html lang={htmlLang} className={`${inter.variable} ${sora.variable}`}>
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
