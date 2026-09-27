// FILE: src/platform/validation/corpus.ts
export interface ValidationCase { id: string; fixture: string; expectation: Record<string, Array<{ severity: string; messageIncludes: string }>> }
export interface ValidationBreakdown { key: string; expected: number; actual: number; matched: boolean }
export interface ValidationRun { caseId: string; passed: boolean; breakdown: ValidationBreakdown[]; durationsMs: number }
export interface ValidationResult { passed: boolean; score: number; total: number; missing: number; extra: number; runs: ValidationRun[] }
export function runCorpus(analyze: (fixture: string) => Promise<Array<{ ruleId?: string; filePath?: string; severity: string; message: string }>>, cases: ValidationCase[]): Promise<ValidationResult> {
  return cases.reduce(async (acc, testCase) => {
    const previous: ValidationResult = await acc;
    const startedAt = Date.now();
    const findings = await analyze(testCase.fixture);
    const breakdown: ValidationBreakdown[] = Object.keys(testCase.expectation).map((key) => {
      const expectedSet = testCase.expectation[key];
      const actualSet = findings.filter((f) => (f.ruleId ?? f.filePath ?? "all") === key);
      const matched = expectedSet.length === 0 ? actualSet.length === 0 : actualSet.length > 0 && actualSet.some((f) => expectedSet.some((e) => f.severity === e.severity && f.message.includes(e.messageIncludes)));
      return { key, expected: expectedSet.length, actual: actualSet.length, matched };
    });
    const passed = breakdown.every((b) => b.matched || b.expected === 0);
    const run: ValidationRun = { caseId: testCase.id, passed, breakdown, durationsMs: Date.now() - startedAt };
    return { passed: previous.passed && passed, score: previous.score + (passed ? 1 : 0), total: previous.total + 1, missing: previous.missing + breakdown.filter((b) => b.expected > 0 && !b.matched).length, extra: previous.extra + breakdown.filter((b) => b.expected === 0 && b.actual > 0).length, runs: [...previous.runs, run] };
  }, Promise.resolve({ passed: true, score: 0, total: 0, missing: 0, extra: 0, runs: [] as ValidationRun[] }));
}
export function corpusCoverage(cases: ValidationCase[], sampleLines: Array<{ id: string; lines: number }>): Array<{ id: string; lines: number; cases: number; status: string }> { return sampleLines.map((sample) => ({ id: sample.id, lines: sample.lines, cases: cases.filter((c) => c.fixture.includes(sample.id)).length, status: cases.some((c) => c.fixture.includes(sample.id) && c.fixture.includes("throw")) ? "error-path" : "covered" })); }