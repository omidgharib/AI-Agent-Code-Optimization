import { useEffect, type ReactNode } from "react";
import { setLanguage, useLanguage } from "../i18n";

const links = [["/code", "Code Audit"], ["/seo", "SEO Workspace"], ["/runs/recent", "Runs"], ["/settings", "Settings"]] as const;
const faLabels = ["ممیزی کد", "فضای کاری سئو", "اجراها", "تنظیمات"];

export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = window.location.pathname;
  const lang = useLanguage();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);
  const labels = lang === "fa" ? faLabels : links.map((item) => item[1]);
  return <div className="global-shell">
    <header className="global-header">
      <a className="global-brand" href="/code"><span>AI</span><strong>{lang === "fa" ? "ممیز هوشمند" : "AI Auditor"}</strong></a>
      <div className="global-header-actions">
        <nav aria-label={lang === "fa" ? "فضاهای کاری" : "Workspaces"}>
          {links.map(([href], index) => <a key={href} className={pathname === href || (href.startsWith("/runs") && pathname.startsWith("/runs/")) ? "active" : ""} href={href}>{labels[index]}</a>)}
        </nav>
        <button className="global-language" data-testid="language-toggle" type="button" onClick={() => setLanguage(lang === "fa" ? "en" : "fa")} aria-label={lang === "fa" ? "تغییر زبان به انگلیسی" : "Switch language to Persian"}>{lang === "fa" ? "EN" : "فا"}</button>
      </div>
    </header>
    <div className="global-content">{children}</div>
  </div>;
}
