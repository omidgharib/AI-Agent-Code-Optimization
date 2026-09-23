// FILE: src/report/pdf.ts
export interface PdfTextBlock { lines: string[] }

const escapePdf = (text: string) => {
  const ascii = text.replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  return ascii;
};

function splitLines(text: string, widthChars: number): string[] {
  const hard = text.split(/\r?\n/);
  const wrapped: string[] = [];
  for (const line of hard) {
    const words = line.split(" ");
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length <= widthChars) current = `${current} ${word}`.trim();
      else { if (current) wrapped.push(current); current = word; }
    }
    wrapped.push(current);
  }
  return wrapped;
}

export function buildPdf(title: string, blocks: PdfTextBlock[], opts: { fontSize?: number; lineHeight?: number; pageWidth?: number; pageHeight?: number; margin?: number; filename?: string } = {}): Buffer {
  const fontSize = opts.fontSize ?? 10;
  const lineHeight = opts.lineHeight ?? 14;
  const pageHeight = opts.pageHeight ?? 842;
  const margin = opts.margin ?? 50;
  const bodyStart = pageHeight - margin;
  const widthChars = Math.floor((opts.pageWidth ?? 595 - margin * 2) / (fontSize * 0.55));
  const maxLine = Math.floor((pageHeight - margin * 2) / lineHeight) - 2;
  const allLines: string[] = [title, ...blocks.flatMap((block) => splitLines(block.lines.join(" "), widthChars))];
  const pages: string[][] = [];
  for (let i = 0; i < allLines.length; i += maxLine) pages.push(allLines.slice(i, i + maxLine));

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 4} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((_, i) => objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${opts.pageWidth ?? 595} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents ${5 + i * 4} 0 R >>`));
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((page) => {
    const stream = [`BT /F1 ${fontSize} Tf ${margin} ${bodyStart} Td 14 TL`, ...page.map((line) => `(${escapePdf(line)}) Tj T*`), "ET"].join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Producer (ai-auditor) /Title (report.pdf) >>");

  let pdf = `%PDF-1.4\n`;
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export function reportToPdf(data: { summary?: { total: number; bySeverity?: Record<string, number> }; topIssues?: Array<{ severity: string; ruleId?: string; message: string; location?: { filePath?: string; startLine?: number } }>; generatedAt?: string }): Buffer {
  const block: PdfTextBlock = { lines: (data.topIssues ?? []).map((issue) => `[${issue.severity.toUpperCase()}] ${issue.ruleId ?? "finding"}: ${issue.message} — ${issue.location?.filePath ?? "-"}${issue.location?.startLine ? `:${issue.location.startLine}` : ""}`) };
  const summary = `Generated ${data.generatedAt ?? ""} · ${data.summary?.total ?? 0} issue(s)${data.summary?.bySeverity ? ` (${Object.entries(data.summary.bySeverity).map(([key, value]) => `${key}:${value}`).join(", ")})` : ""}`;
  return buildPdf("AI Auditor report", [{ lines: [summary] }, block]);
}