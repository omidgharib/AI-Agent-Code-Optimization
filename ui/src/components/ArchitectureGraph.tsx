import { useMemo, useState } from "react";

type Node = { file: string; imports: string[]; kind: string };
export function ArchitectureGraph({ nodes, cycles, lang }: { nodes: Node[]; cycles: string[][]; lang: string }) {
  const [query, setQuery] = useState("");
  const [file, setFile] = useState("");
  const [onlyCycles, setOnlyCycles] = useState(false);
  const fa = lang === "fa";
  const cycleFiles = useMemo(() => new Set(cycles.flat()), [cycles]);
  const matches = nodes.filter(node => node.file.toLowerCase().includes(query.toLowerCase()) && (!onlyCycles || cycleFiles.has(node.file)));
  const selected = matches.find(node => node.file === file) ?? matches[0];
  const reverse = useMemo(() => {
    const map = new Map<string, string[]>();
    nodes.forEach(node => node.imports.forEach(target => map.set(target, [...(map.get(target) ?? []), node.file])));
    return map;
  }, [nodes]);
  const affected = new Set<string>();
  if (selected) {
    const queue = [...(reverse.get(selected.file) ?? [])];
    for (let i = 0; i < queue.length; i++) {
      const next = queue[i];
      if (next === selected.file || affected.has(next)) continue;
      affected.add(next); queue.push(...(reverse.get(next) ?? []));
    }
  }
  const neighbors = selected ? [...new Set([...selected.imports, ...(reverse.get(selected.file) ?? [])])].filter(name => name !== selected.file) : [];
  const visible = neighbors.slice(0, 24);
  return <div className="insight-view" data-testid="architecture-graph">
    <div className="insight-controls"><input aria-label={fa ? "جستجوی ماژول" : "Search modules"} placeholder={fa ? "جستجوی ماژول" : "Search modules"} value={query} onChange={e => setQuery(e.target.value)}/><label><input type="checkbox" checked={onlyCycles} onChange={e => setOnlyCycles(e.target.checked)}/>{fa ? "فقط چرخه‌ها" : "Cycles only"}</label><select aria-label={fa ? "انتخاب ماژول" : "Select module"} value={selected?.file ?? ""} onChange={e => setFile(e.target.value)}>{matches.map(node => <option key={node.file}>{node.file}</option>)}</select></div>
    {selected ? <><p><code>{selected.file}</code> · {fa ? "فایل‌های متاثر از تغییر" : "Files affected by changes"}: {affected.size}</p><p>{fa ? "پیکان از واردکننده به وابستگی است. برای بررسی هر فایل روی آن کلیک کنید." : "Arrows point from importer to dependency. Select a file to explore its neighbors."}</p>
      <svg viewBox="0 0 900 580" role="img" aria-label={fa ? "نمودار وابستگی‌ها" : "Dependency graph"} className="architecture-svg">
        <defs><marker id="dependency-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
        {visible.map((name, index) => {
          const angle = 2 * Math.PI * index / Math.max(1, visible.length);
          const x = 450 + 320 * Math.cos(angle), y = 290 + 240 * Math.sin(angle);
          const outgoing = selected.imports.includes(name);
          const incoming = reverse.get(selected.file)?.includes(name);
          return <g key={name}><line x1="450" y1="290" x2={x} y2={y} markerEnd={outgoing ? "url(#dependency-arrow)" : undefined} markerStart={incoming ? "url(#dependency-arrow)" : undefined}/><g role="button" tabIndex={0} aria-label={name} onClick={() => { setQuery(""); setOnlyCycles(false); setFile(name); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setQuery(""); setOnlyCycles(false); setFile(name); } }} className={cycleFiles.has(name) ? "cycle-node" : ""}><title>{name}</title><rect x={x-80} y={y-16} width="160" height="32" rx="8"/><text x={x} y={y+4} textAnchor="middle">{name.length > 23 ? `…${name.slice(-22)}` : name}</text></g></g>;
        })}<rect x="350" y="270" width="200" height="40" rx="10" className="graph-focus"/><text x="450" y="295" textAnchor="middle">{selected.file.slice(-28)}</text>
      </svg>{neighbors.length > visible.length && <p>{fa ? "برای خوانایی فقط ۲۴ همسایه نمایش داده شده است؛ فهرست کامل در ادامه آمده است." : "Showing 24 neighbors for readability; the complete list follows."}</p>}<div className="graph-neighbors">{neighbors.map(name => <button key={name} onClick={() => { setQuery(""); setOnlyCycles(false); setFile(name); }}>{name}</button>)}</div><details><summary>{fa ? "مسیرهای چرخه" : "Cycle paths"} ({cycles.length})</summary>{cycles.map((cycle, i) => <p dir="ltr" key={i}>{cycle.join(" → ")}</p>)}</details></> : <p>{fa ? "ماژولی با این فیلتر یافت نشد." : "No modules match these filters."}</p>}
  </div>;
}
