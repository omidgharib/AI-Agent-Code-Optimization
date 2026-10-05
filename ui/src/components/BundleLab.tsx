import { useState } from "react";

export interface BundleData { tool: string; totalBytes: number; duplicatedBytes: number; modules: { name: string; bytes: number; chunks: string[]; duplicated: boolean }[] }
export function BundleLab({ bundle, lang }: { bundle?: BundleData; lang: string }) {
  const [query, setQuery] = useState("");
  const [duplicates, setDuplicates] = useState(false);
  const [selected, setSelected] = useState("");
  const fa = lang === "fa";
  const rows = bundle?.modules.filter(item => item.name.toLowerCase().includes(query.toLowerCase()) && (!duplicates || item.duplicated)).sort((a,b) => b.bytes-a.bytes) ?? [];
  const detail = bundle?.modules.find(item => item.name === selected);
  return <section id="bundle" className="panel insight-view" data-testid="bundle-lab"><h2>{fa ? "بهینه‌سازی و ترکیب بسته‌ها" : "Bundle optimization and composition"}</h2>{bundle ? <>
    <p>{bundle.tool} · {fa ? "حجم ماژول‌های گزارش‌شده" : "Reported module weight"}: {(bundle.totalBytes/1024).toFixed(1)} KB · {fa ? "حجم ماژول‌های چندبخشی" : "Weight of modules in multiple chunks"}: {(bundle.duplicatedBytes/1024).toFixed(1)} KB</p>
    <p>{fa ? "این اعداد حجم فشرده انتقال نیستند. حضور در چند بخش، نشانه‌ای برای بررسی اشتراک کد است و به‌تنهایی اتلاف قطعی را اثبات نمی‌کند." : "These are not compressed transfer sizes. Presence in multiple chunks warrants checking shared code and does not by itself prove wasted bytes."}</p>
    <div className="insight-controls"><input aria-label={fa ? "جستجوی بسته" : "Search bundle"} placeholder={fa ? "جستجوی بسته" : "Search bundle"} value={query} onChange={e => setQuery(e.target.value)}/><label><input type="checkbox" checked={duplicates} onChange={e => setDuplicates(e.target.checked)}/>{fa ? "فقط ماژول‌های چندبخشی" : "Multi-chunk modules only"}</label></div>
    <div className="bundle-rows">{rows.slice(0, 100).map(item => <button key={item.name} onClick={() => setSelected(item.name)} aria-pressed={selected === item.name}><code>{item.name}</code><span>{(item.bytes/1024).toFixed(1)} KB · {bundle.totalBytes ? (100*item.bytes/bundle.totalBytes).toFixed(1) : 0}%</span><meter min="0" max={Math.max(1,bundle.totalBytes)} value={item.bytes}/></button>)}</div><p>{rows.length} {fa ? "نتیجه؛ نمایش حداکثر ۱۰۰ مورد" : "matches; showing up to 100"}</p>
    {detail && <article><h3>{detail.name}</h3><p>{fa ? "بخش‌های خروجی" : "Output chunks"}</p><pre>{detail.chunks.join("\n") || "—"}</pre><p>{detail.duplicated ? (fa ? "پیشنهاد: امکان انتقال کد مشترک به یک بخش مستقل بررسی شود." : "Suggestion: check whether shared code can be extracted into one chunk.") : (fa ? "پیشنهاد: بارگذاری تنبل و وابستگی‌های این ماژول بررسی شود." : "Suggestion: review lazy loading and this module's dependencies.")}</p></article>}
  </> : <p>{fa ? "داده حجم بسته موجود نیست. فایل bundle-stats.json یا esbuild-meta.json را در ریشه پروژه قرار دهید و ممیزی را دوباره اجرا کنید." : "No bundle metadata available. Place bundle-stats.json or esbuild-meta.json in the project root and run another audit."}</p>}</section>;
}
