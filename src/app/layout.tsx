import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Kannada } from "next/font/google";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { currentLang } from "@/lib/session-lang";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-kannada", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "CivicAI Mysuru", template: "%s · CivicAI Mysuru" },
  description: "Verified, ward-level waste-collection disruption alerts for Mysuru citizens. AI never invents a municipal schedule.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#126b63",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await currentLang();
  return (
    <html lang={lang} className={`${inter.variable} ${kannada.variable}`}>
      <body className="min-h-dvh font-sans">
        <I18nProvider lang={lang}>{children}</I18nProvider>
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
