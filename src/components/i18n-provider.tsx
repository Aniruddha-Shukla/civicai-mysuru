"use client";

import { createContext, useContext, useMemo } from "react";
import { getT, type Lang, type TFunction } from "@/lib/i18n";

const I18nContext = createContext<{ lang: Lang; t: TFunction }>({ lang: "en", t: getT("en") });

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: getT(lang) }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
