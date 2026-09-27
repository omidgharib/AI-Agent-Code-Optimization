import { useEffect, useState } from "react";
import { api } from "../api/client";
import { localizeStatus, useLanguage } from "../i18n";

export function RunsPage() {
  const lang = useLanguage();
  const [jobs, setJobs] = useState<Array<{ id: string; status: string }>>([]);
  useEffect(() => { void api<Array<{ id: string; status: string }>>("/api/jobs").then(setJobs).catch(() => setJobs([])); }, []);
  const fa = lang === "fa";
  return <main className="route-page"><header className="route-heading"><div><span className="eyebrow">{fa ? "فعالیت‌ها" : "ACTIVITY"}</span><h1>{fa ? "اجراها" : "Runs"}</h1><p>{fa ? "ممیزی‌های اخیر کد و اجراهای سازگاری." : "Recent Code Audit and compatibility runs."}</p></div></header><section className="route-card">{jobs.length ? <ul className="run-list">{jobs.map((job) => <li key={job.id}><code>{job.id}</code><span className={`status-pill ${job.status}`}>{localizeStatus(job.status, lang)}</span></li>)}</ul> : <div className="empty-state"><strong>{fa ? "هنوز اجرایی وجود ندارد" : "No runs yet"}</strong><p>{fa ? "یک ممیزی را از فضای کد یا سئو آغاز کنید." : "Start an audit from the Code or SEO workspace."}</p></div>}</section></main>;
}
