"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { DEFAULT_LANG, localeOf, type Lang, type Localized } from "./index";

const STORAGE_KEY = "devtility.lang";
const CHANGE_EVENT = "devtility:lang";

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "vi";
  } catch {
    return DEFAULT_LANG;
  }
}

function getServerSnapshot(): Lang {
  return DEFAULT_LANG;
}

export function setStoredLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // private mode — keep in-memory only for this event cycle
  }
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Current UI language + helpers. Usage:
 *   const { lang, t, locale, setLang } = useI18n();
 *   <h1>{t(M.title)}</h1>
 */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep <html lang> in sync with the current language. setStoredLang only
  // covers same-tab toggles; this also handles the restored preference after
  // hydration and cross-tab "storage" changes. Idempotent, so it is safe for
  // every component using the hook to run it.
  useEffect(() => {
    if (document.documentElement.lang !== lang) document.documentElement.lang = lang;
  }, [lang]);

  const translate = useCallback((text: Localized) => text[lang], [lang]);
  return {
    lang,
    setLang: setStoredLang,
    t: translate,
    locale: localeOf(lang),
  };
}
