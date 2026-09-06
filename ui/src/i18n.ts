import { useSyncExternalStore } from "react";

export type Lang = "fa" | "en";
const EVENT = "ai-auditor-language-change";
const read = (): Lang => localStorage.getItem("ai-auditor-lang") === "en" ? "en" : "fa";
const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
};
export function useLanguage(): Lang { return useSyncExternalStore(subscribe, read, () => "fa"); }
export function setLanguage(lang: Lang) {
  localStorage.setItem("ai-auditor-lang", lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  window.dispatchEvent(new Event(EVENT));
}
export function localizeStatus(status: string, lang: Lang) {
  if (lang === "en") return status;
  return ({ queued: "در صف", running: "در حال اجرا", completed: "تکمیل‌شده", failed: "ناموفق", cancelled: "لغوشده", ready: "آماده", preview: "پیش‌نمایش", applied: "اعمال‌شده" } as Record<string,string>)[status] ?? status;
}
