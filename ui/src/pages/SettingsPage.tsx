import { useLanguage } from "../i18n";

export function SettingsPage() {
  const fa = useLanguage() === "fa";
  return <main className="route-page"><header className="route-heading"><div><span className="eyebrow">{fa ? "حالت محلی" : "LOCAL MODE"}</span><h1>{fa ? "تنظیمات" : "Settings"}</h1><p>{fa ? "تنظیمات زمان اجرا و ارائه‌دهنده برای این نصب." : "Runtime and provider settings for this installation."}</p></div></header><section className="route-card settings-grid"><article><span>{fa ? "استقرار" : "Deployment"}</span><strong>{fa ? "محلی" : "Local"}</strong><p>{fa ? "پروفایل امنیتی محدود به همین دستگاه." : "Loopback-only server security profile."}</p></article><article><span>{fa ? "ذخیره‌سازی خروجی‌ها" : "Artifact storage"}</span><strong>{fa ? "سیستم فایل" : "Filesystem"}</strong><p>{fa ? "گزارش‌ها روی همین دستگاه باقی می‌مانند." : "Reports remain on this machine."}</p></article><article><span>{fa ? "قراردادهای API" : "API contracts"}</span><strong>{fa ? "نسخه ۱" : "Version 1"}</strong><p>{fa ? "اعتبارسنجی زمان اجرا فعال است." : "Runtime validation is enabled."}</p></article></section></main>;
}
