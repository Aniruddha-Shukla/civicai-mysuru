import type { Metadata, Viewport } from "next";
import { Noto_Sans_Kannada, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { PointerFx } from "@/components/motion/pointer-fx";
import { currentLang } from "@/lib/session-lang";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-kannada", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "CivicAI Mysuru", template: "%s · CivicAI Mysuru" },
  description: "Verified, ward-level waste-collection disruption alerts for Mysuru citizens. AI never invents a municipal schedule.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a4d3e",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await currentLang();
  return (
    <html lang={lang} className={`${jakarta.variable} ${kannada.variable}`}>
      <body className="min-h-dvh font-sans">
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <I18nProvider lang={lang}>{children}</I18nProvider>
        <PointerFx />
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
