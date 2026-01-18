#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/**
 * E2E Test Report Generator
 *
 * Generates an insanely detailed HTML report from Deno test output.
 *
 * Usage: deno run --allow-all scripts/generate-e2e-report.ts <test-output-file> <report-output-file>
 */

import { parse as parseArgs } from "https://deno.land/std@0.208.0/flags/mod.ts";

interface TestResult {
  name: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  category?: string;
  api?: string;
  testType?: string;
}

interface TestFile {
  name: string;
  path: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  api?: string;
}

interface APIStats {
  name: string;
  endpoint: string;
  passed: number;
  failed: number;
  skipped: number;
  totalTests: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  healthScore: number;
  tests: TestResult[];
}

interface CategoryStats {
  name: string;
  icon: string;
  passed: number;
  failed: number;
  total: number;
  tests: TestResult[];
}

interface ReportData {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  passRate: number;
  files: TestFile[];
  apis: Map<string, APIStats>;
  categories: Map<string, CategoryStats>;
  slowestTests: TestResult[];
  failedTests: TestResult[];
  flakyTests: TestResult[];
  edgeCases: TestResult[];
  securityTests: TestResult[];
  performanceMetrics: {
    avgDuration: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    maxDuration: number;
    minDuration: number;
  };
  durationDistribution: { range: string; count: number; percentage: number }[];
  timestamp: string;
  gitBranch: string;
  gitCommit: string;
  denoVersion: string;
  supabaseVersion: string;
}

// Parse test output file
function parseTestOutput(content: string): TestResult[] {
  const results: TestResult[] = [];
  const lines = content.split('\n');

  // Strip ANSI codes
  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

  let currentFile = '';
  let currentErrors: Map<string, string> = new Map();
  let inErrorBlock = false;
  let errorTestName = '';
  let errorContent = '';

  // First pass: collect errors
  for (let i = 0; i < lines.length; i++) {
    const line = stripAnsi(lines[i]);

    // Detect error block start
    if (line.includes('ERRORS') || line.includes('FAILURES')) {
      inErrorBlock = true;
      continue;
    }

    // Detect error test name
    const errorMatch = line.match(/^(.+) => \.\/(tests\/e2e\/[^:]+)/);
    if (errorMatch && inErrorBlock) {
      if (errorTestName && errorContent) {
        currentErrors.set(errorTestName, errorContent);
      }
      errorTestName = errorMatch[1].trim();
      errorContent = '';
      continue;
    }

    // Collect error content
    if (inErrorBlock && errorTestName && !line.match(/^[A-Z]+ \|/)) {
      errorContent += line + '\n';
    }

    // End of error block
    if (line.match(/^(ok|FAILED) \|/)) {
      if (errorTestName && errorContent) {
        currentErrors.set(errorTestName, errorContent);
      }
      inErrorBlock = false;
    }
  }

  // Second pass: collect test results
  for (const line of lines) {
    const cleanLine = stripAnsi(line);

    // Detect file
    const fileMatch = cleanLine.match(/running \d+ tests? from \.\/(tests\/e2e\/[^\s]+)/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    // Detect test result
    const testMatch = cleanLine.match(/^(.+?) \.\.\.\.* (ok|FAILED|ignored)(?: \((\d+(?:\.\d+)?)(m?s)\))?/);
    if (testMatch) {
      const name = testMatch[1].trim();
      const status = testMatch[2] === 'ok' ? 'passed' : testMatch[2] === 'FAILED' ? 'failed' : 'skipped';
      let duration = parseFloat(testMatch[3] || '0');
      if (testMatch[4] === 's') duration *= 1000; // Convert seconds to ms

      const result: TestResult = {
        name,
        file: currentFile || 'unknown',
        status,
        duration,
        error: currentErrors.get(name),
        category: categorizeTest(name),
        api: extractAPI(currentFile),
        testType: detectTestType(name),
      };

      results.push(result);
    }
  }

  return results;
}

function categorizeTest(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('edge') || lowerName.includes('edge-')) return 'Edge Case';
  if (lowerName.includes('sec-') || lowerName.includes('security')) return 'Security';
  if (lowerName.includes('race-') || lowerName.includes('concurrent')) return 'Race Condition';
  if (lowerName.includes('validation') || lowerName.includes('invalid')) return 'Validation';
  if (lowerName.includes('auth') || lowerName.includes('permission')) return 'Authorization';
  if (lowerName.includes('cors')) return 'CORS';
  if (lowerName.includes('create') || lowerName.includes('post')) return 'Create';
  if (lowerName.includes('update') || lowerName.includes('put')) return 'Update';
  if (lowerName.includes('delete')) return 'Delete';
  if (lowerName.includes('get') || lowerName.includes('list') || lowerName.includes('search')) return 'Read';
  return 'General';
}

function extractAPI(file: string): string {
  const match = file.match(/api-([^/.]+)/);
  return match ? `api-${match[1]}` : 'unknown';
}

function detectTestType(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('comp-') || lowerName.includes('edge-') || lowerName.includes('sec-')) return 'Edge Case';
  if (lowerName.includes('setup')) return 'Setup';
  if (lowerName.includes('should')) return 'Behavior';
  return 'Functional';
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function generateReportData(results: TestResult[]): ReportData {
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const durations = results.map(r => r.duration).filter(d => d > 0);

  // Group by file
  const fileMap = new Map<string, TestFile>();
  for (const result of results) {
    if (!fileMap.has(result.file)) {
      fileMap.set(result.file, {
        name: result.file.split('/').pop() || result.file,
        path: result.file,
        tests: [],
        passed: 0,
        failed: 0,
        skipped: 0,
        totalDuration: 0,
        api: result.api,
      });
    }
    const file = fileMap.get(result.file)!;
    file.tests.push(result);
    file.totalDuration += result.duration;
    if (result.status === 'passed') file.passed++;
    else if (result.status === 'failed') file.failed++;
    else file.skipped++;
  }

  // Group by API
  const apiMap = new Map<string, APIStats>();
  for (const result of results) {
    const api = result.api || 'unknown';
    if (!apiMap.has(api)) {
      apiMap.set(api, {
        name: api,
        endpoint: `/${api.replace('api-', '')}`,
        passed: 0,
        failed: 0,
        skipped: 0,
        totalTests: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: Infinity,
        healthScore: 100,
        tests: [],
      });
    }
    const apiStats = apiMap.get(api)!;
    apiStats.tests.push(result);
    apiStats.totalTests++;
    if (result.status === 'passed') apiStats.passed++;
    else if (result.status === 'failed') apiStats.failed++;
    else apiStats.skipped++;
    apiStats.maxDuration = Math.max(apiStats.maxDuration, result.duration);
    apiStats.minDuration = Math.min(apiStats.minDuration, result.duration);
  }

  // Calculate API health scores
  for (const [_, api] of apiMap) {
    api.avgDuration = api.tests.reduce((sum, t) => sum + t.duration, 0) / api.tests.length;
    api.healthScore = api.totalTests > 0 ? Math.round((api.passed / api.totalTests) * 100) : 0;
    if (api.minDuration === Infinity) api.minDuration = 0;
  }

  // Group by category
  const categoryMap = new Map<string, CategoryStats>();
  const categoryIcons: Record<string, string> = {
    'Edge Case': '🎯',
    'Security': '🔐',
    'Race Condition': '⚡',
    'Validation': '✅',
    'Authorization': '🔑',
    'CORS': '🌐',
    'Create': '➕',
    'Update': '✏️',
    'Delete': '🗑️',
    'Read': '📖',
    'General': '📋',
  };

  for (const result of results) {
    const cat = result.category || 'General';
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, {
        name: cat,
        icon: categoryIcons[cat] || '📋',
        passed: 0,
        failed: 0,
        total: 0,
        tests: [],
      });
    }
    const category = categoryMap.get(cat)!;
    category.tests.push(result);
    category.total++;
    if (result.status === 'passed') category.passed++;
    else if (result.status === 'failed') category.failed++;
  }

  // Duration distribution
  const ranges = [
    { min: 0, max: 50, label: '0-50ms' },
    { min: 50, max: 100, label: '50-100ms' },
    { min: 100, max: 200, label: '100-200ms' },
    { min: 200, max: 500, label: '200-500ms' },
    { min: 500, max: 1000, label: '500ms-1s' },
    { min: 1000, max: 2000, label: '1-2s' },
    { min: 2000, max: Infinity, label: '2s+' },
  ];

  const durationDistribution = ranges.map(range => {
    const count = results.filter(r => r.duration >= range.min && r.duration < range.max).length;
    return {
      range: range.label,
      count,
      percentage: results.length > 0 ? Math.round((count / results.length) * 100) : 0,
    };
  });

  return {
    totalTests: results.length,
    passed,
    failed,
    skipped,
    totalDuration,
    passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    files: Array.from(fileMap.values()).sort((a, b) => b.failed - a.failed || a.name.localeCompare(b.name)),
    apis: apiMap,
    categories: categoryMap,
    slowestTests: [...results].sort((a, b) => b.duration - a.duration).slice(0, 20),
    failedTests: results.filter(r => r.status === 'failed'),
    flakyTests: [], // Would need historical data
    edgeCases: results.filter(r => r.testType === 'Edge Case'),
    securityTests: results.filter(r => r.category === 'Security'),
    performanceMetrics: {
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p50: calculatePercentile(durations, 50),
      p90: calculatePercentile(durations, 90),
      p95: calculatePercentile(durations, 95),
      p99: calculatePercentile(durations, 99),
      maxDuration: Math.max(...durations, 0),
      minDuration: Math.min(...durations, 0),
    },
    durationDistribution,
    timestamp: new Date().toISOString(),
    gitBranch: '',
    gitCommit: '',
    denoVersion: '',
    supabaseVersion: '',
  };
}

async function getEnvironmentInfo(): Promise<{ gitBranch: string; gitCommit: string; denoVersion: string; supabaseVersion: string }> {
  const run = async (cmd: string[]): Promise<string> => {
    try {
      const p = new Deno.Command(cmd[0], { args: cmd.slice(1), stdout: 'piped', stderr: 'null' });
      const { stdout } = await p.output();
      return new TextDecoder().decode(stdout).trim();
    } catch {
      return 'unknown';
    }
  };

  return {
    gitBranch: await run(['git', 'branch', '--show-current']),
    gitCommit: await run(['git', 'rev-parse', '--short', 'HEAD']),
    denoVersion: (await run(['deno', '--version'])).split('\n')[0],
    supabaseVersion: await run(['supabase', '--version']),
  };
}

function generateHTML(data: ReportData): string {
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const apiArray = Array.from(data.apis.values()).sort((a, b) => b.totalTests - a.totalTests);
  const categoryArray = Array.from(data.categories.values()).sort((a, b) => b.total - a.total);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report - pdeservice-spb</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --success: #22c55e;
      --success-bg: #dcfce7;
      --success-dark: #166534;
      --failure: #ef4444;
      --failure-bg: #fee2e2;
      --failure-dark: #991b1b;
      --warning: #f59e0b;
      --warning-bg: #fef3c7;
      --info: #3b82f6;
      --info-bg: #dbeafe;
      --purple: #8b5cf6;
      --purple-bg: #ede9fe;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #1e293b;
      --muted: #64748b;
      --border: #e2e8f0;
      --code-bg: #1e293b;
      --code: #e2e8f0;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --card: #1e293b;
        --text: #f1f5f9;
        --muted: #94a3b8;
        --border: #334155;
        --success-bg: #14532d;
        --failure-bg: #7f1d1d;
        --warning-bg: #78350f;
        --info-bg: #1e3a5f;
        --purple-bg: #4c1d95;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }

    /* Navigation */
    .nav { position: sticky; top: 0; background: var(--card); border-bottom: 1px solid var(--border); z-index: 100; padding: 0.75rem 2rem; display: flex; gap: 1rem; overflow-x: auto; }
    .nav a { color: var(--muted); text-decoration: none; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.875rem; white-space: nowrap; transition: all 0.2s; }
    .nav a:hover, .nav a.active { background: var(--info-bg); color: var(--info); }

    /* Container */
    .container { max-width: 1600px; margin: 0 auto; padding: 2rem; }

    /* Header */
    .header { display: grid; grid-template-columns: 1fr auto; gap: 2rem; margin-bottom: 2rem; align-items: start; }
    .header-title { display: flex; align-items: center; gap: 1rem; }
    .header-title h1 { font-size: 2rem; }
    .header-title .status { padding: 0.5rem 1.5rem; border-radius: 9999px; font-weight: 600; font-size: 0.875rem; }
    .header-title .status.passed { background: var(--success-bg); color: var(--success-dark); }
    .header-title .status.failed { background: var(--failure-bg); color: var(--failure-dark); }
    .header-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem 2rem; font-size: 0.75rem; color: var(--muted); font-family: monospace; }

    /* Section */
    section { margin-bottom: 3rem; scroll-margin-top: 4rem; }
    section h2 { font-size: 1.25rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    section h2 .badge { font-size: 0.75rem; padding: 0.25rem 0.75rem; background: var(--border); border-radius: 9999px; font-weight: 500; }

    /* Cards Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; }
    .stat-card .label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    .stat-card .value { font-size: 2.5rem; font-weight: 700; line-height: 1; }
    .stat-card .value.success { color: var(--success); }
    .stat-card .value.failure { color: var(--failure); }
    .stat-card .value.warning { color: var(--warning); }
    .stat-card .value.info { color: var(--info); }
    .stat-card .subtitle { font-size: 0.875rem; color: var(--muted); margin-top: 0.5rem; }
    .stat-card .progress { height: 6px; background: var(--border); border-radius: 9999px; margin-top: 1rem; overflow: hidden; }
    .stat-card .progress-bar { height: 100%; border-radius: 9999px; transition: width 0.5s ease; }
    .stat-card .progress-bar.success { background: var(--success); }
    .stat-card .progress-bar.failure { background: var(--failure); }

    /* Charts Row */
    .charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .chart-card { background: var(--card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; }
    .chart-card h3 { font-size: 1rem; margin-bottom: 1rem; }
    .chart-container { position: relative; height: 250px; }

    /* API Health Grid */
    .api-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .api-card { background: var(--card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.25rem; transition: all 0.2s; cursor: pointer; }
    .api-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .api-card .api-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .api-card .api-name { font-weight: 600; font-family: monospace; font-size: 0.9rem; }
    .api-card .api-health { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .api-card .api-health.excellent { background: var(--success-bg); color: var(--success-dark); }
    .api-card .api-health.good { background: var(--info-bg); color: var(--info); }
    .api-card .api-health.warning { background: var(--warning-bg); color: var(--warning); }
    .api-card .api-health.critical { background: var(--failure-bg); color: var(--failure-dark); }
    .api-card .api-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; text-align: center; font-size: 0.75rem; }
    .api-card .api-stats .stat { padding: 0.5rem; background: var(--bg); border-radius: 0.5rem; }
    .api-card .api-stats .stat-value { font-size: 1.25rem; font-weight: 700; }
    .api-card .api-stats .stat-label { color: var(--muted); }
    .api-card .api-timing { margin-top: 1rem; font-size: 0.75rem; color: var(--muted); display: flex; justify-content: space-between; }

    /* Category Pills */
    .category-pills { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 2rem; }
    .category-pill { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: var(--card); border: 1px solid var(--border); border-radius: 9999px; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; }
    .category-pill:hover { background: var(--info-bg); border-color: var(--info); }
    .category-pill .icon { font-size: 1.25rem; }
    .category-pill .count { padding: 0.125rem 0.5rem; background: var(--border); border-radius: 9999px; font-size: 0.75rem; }
    .category-pill .count.has-failures { background: var(--failure-bg); color: var(--failure-dark); }

    /* Performance Metrics */
    .perf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .perf-metric { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem; text-align: center; }
    .perf-metric .label { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.25rem; }
    .perf-metric .value { font-size: 1.5rem; font-weight: 700; color: var(--info); }

    /* Test Files */
    .test-file { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; margin-bottom: 0.75rem; overflow: hidden; }
    .test-file.has-failures { border-left: 4px solid var(--failure); }
    .test-file.all-passed { border-left: 4px solid var(--success); }
    .test-file-header { padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
    .test-file-header:hover { background: var(--bg); }
    .test-file-info { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0; }
    .test-file-icon { font-size: 1.5rem; }
    .test-file-name { font-weight: 500; font-family: monospace; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .test-file-stats { display: flex; gap: 1rem; font-size: 0.875rem; flex-shrink: 0; }
    .test-file-stats span { display: flex; align-items: center; gap: 0.25rem; }
    .test-file-stats .passed { color: var(--success); }
    .test-file-stats .failed { color: var(--failure); }
    .test-file-stats .duration { color: var(--muted); }
    .expand-icon { transition: transform 0.2s; color: var(--muted); }
    .test-file.expanded .expand-icon { transform: rotate(180deg); }
    .test-cases { display: none; border-top: 1px solid var(--border); max-height: 600px; overflow-y: auto; }
    .test-file.expanded .test-cases { display: block; }
    .test-case { padding: 0.75rem 1.25rem 0.75rem 3.5rem; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 0.75rem; font-size: 0.875rem; }
    .test-case:last-child { border-bottom: none; }
    .test-case.passed { background: rgba(34, 197, 94, 0.03); }
    .test-case.failed { background: rgba(239, 68, 68, 0.05); }
    .test-case-icon { flex-shrink: 0; }
    .test-case-icon.pass { color: var(--success); }
    .test-case-icon.fail { color: var(--failure); }
    .test-case-content { flex: 1; min-width: 0; }
    .test-case-name { font-family: monospace; word-break: break-word; }
    .test-case-meta { display: flex; gap: 1rem; margin-top: 0.25rem; font-size: 0.75rem; color: var(--muted); }
    .test-case-error { margin-top: 0.75rem; padding: 0.75rem; background: var(--code-bg); color: var(--code); border-radius: 0.5rem; font-family: monospace; font-size: 0.7rem; white-space: pre-wrap; max-height: 200px; overflow: auto; }

    /* Slowest Tests */
    .slowest-list { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; }
    .slowest-item { padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; }
    .slowest-item:last-child { border-bottom: none; }
    .slowest-item:hover { background: var(--bg); }
    .slowest-name { font-family: monospace; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 1rem; }
    .slowest-duration { font-weight: 600; padding: 0.25rem 0.75rem; background: var(--warning-bg); color: var(--warning); border-radius: 0.25rem; font-size: 0.75rem; flex-shrink: 0; }
    .slowest-rank { width: 2rem; color: var(--muted); font-size: 0.75rem; }

    /* Failed Tests Section */
    .failed-section { background: var(--card); border: 2px solid var(--failure); border-radius: 1rem; overflow: hidden; }
    .failed-header { background: var(--failure-bg); padding: 1rem 1.25rem; font-weight: 600; color: var(--failure-dark); display: flex; align-items: center; gap: 0.75rem; }
    .failed-item { padding: 1.25rem; border-bottom: 1px solid var(--border); }
    .failed-item:last-child { border-bottom: none; }
    .failed-item-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
    .failed-item-name { font-weight: 500; font-family: monospace; font-size: 0.9rem; }
    .failed-item-file { font-size: 0.75rem; color: var(--muted); }
    .failed-item-error { background: var(--code-bg); color: var(--code); padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.75rem; white-space: pre-wrap; max-height: 300px; overflow: auto; }

    /* Filters */
    .filters { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center; position: sticky; top: 60px; background: var(--bg); padding: 1rem 0; z-index: 50; }
    .search-box { flex: 1; min-width: 250px; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--card); color: var(--text); font-size: 0.875rem; }
    .search-box:focus { outline: none; border-color: var(--info); box-shadow: 0 0 0 3px var(--info-bg); }
    .filter-btn { padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--card); color: var(--text); cursor: pointer; font-size: 0.875rem; transition: all 0.2s; }
    .filter-btn:hover { background: var(--border); }
    .filter-btn.active { background: var(--info); color: white; border-color: var(--info); }

    /* Footer */
    .footer { margin-top: 3rem; padding: 2rem; background: var(--card); border-top: 1px solid var(--border); text-align: center; color: var(--muted); font-size: 0.875rem; }

    /* Animations */
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .test-file, .api-card, .stat-card { animation: fadeIn 0.3s ease; }

    /* Responsive */
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      .header { grid-template-columns: 1fr; }
      .charts-row { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    /* Print styles */
    @media print {
      .nav, .filters { display: none; }
      .test-cases { display: block !important; max-height: none; }
      .container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="#overview" class="active">Overview</a>
    <a href="#apis">API Health</a>
    <a href="#categories">Categories</a>
    <a href="#performance">Performance</a>
    <a href="#failed">Failed Tests</a>
    <a href="#slowest">Slowest Tests</a>
    <a href="#all-tests">All Tests</a>
    <a href="#raw">Raw Output</a>
  </nav>

  <div class="container">
    <!-- Header -->
    <header class="header">
      <div>
        <div class="header-title">
          <h1>🧪 E2E Test Report</h1>
          <span class="status ${data.failed > 0 ? 'failed' : 'passed'}">${data.failed > 0 ? 'FAILED' : 'PASSED'}</span>
        </div>
        <p style="color: var(--muted); margin-top: 0.5rem;">pdeservice-spb - Comprehensive End-to-End Test Results</p>
      </div>
      <div class="header-meta">
        <div><strong>Branch:</strong> ${data.gitBranch}</div>
        <div><strong>Commit:</strong> ${data.gitCommit}</div>
        <div><strong>Deno:</strong> ${data.denoVersion}</div>
        <div><strong>Supabase:</strong> ${data.supabaseVersion}</div>
        <div><strong>Generated:</strong> ${new Date(data.timestamp).toLocaleString()}</div>
        <div><strong>Duration:</strong> ${formatDuration(data.totalDuration)}</div>
      </div>
    </header>

    <!-- Overview Section -->
    <section id="overview">
      <h2>📊 Overview</h2>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total Tests</div>
          <div class="value info">${data.totalTests.toLocaleString()}</div>
          <div class="subtitle">${data.files.length} test files</div>
        </div>
        <div class="stat-card">
          <div class="label">Passed</div>
          <div class="value success">${data.passed.toLocaleString()}</div>
          <div class="subtitle">${data.passRate}% pass rate</div>
          <div class="progress"><div class="progress-bar success" style="width: ${data.passRate}%"></div></div>
        </div>
        <div class="stat-card">
          <div class="label">Failed</div>
          <div class="value failure">${data.failed}</div>
          <div class="subtitle">${data.totalTests > 0 ? Math.round((data.failed / data.totalTests) * 100) : 0}% failure rate</div>
        </div>
        <div class="stat-card">
          <div class="label">Skipped</div>
          <div class="value warning">${data.skipped}</div>
          <div class="subtitle">${data.totalTests > 0 ? Math.round((data.skipped / data.totalTests) * 100) : 0}% skipped</div>
        </div>
        <div class="stat-card">
          <div class="label">Duration</div>
          <div class="value">${formatDuration(data.totalDuration)}</div>
          <div class="subtitle">Avg: ${formatDuration(data.performanceMetrics.avgDuration)}/test</div>
        </div>
        <div class="stat-card">
          <div class="label">APIs Tested</div>
          <div class="value info">${data.apis.size}</div>
          <div class="subtitle">${apiArray.filter(a => a.healthScore === 100).length} with 100% pass</div>
        </div>
        <div class="stat-card">
          <div class="label">Edge Cases</div>
          <div class="value">${data.edgeCases.length}</div>
          <div class="subtitle">${data.edgeCases.filter(t => t.status === 'passed').length} passed</div>
        </div>
        <div class="stat-card">
          <div class="label">Security Tests</div>
          <div class="value">${data.securityTests.length}</div>
          <div class="subtitle">${data.securityTests.filter(t => t.status === 'passed').length} passed</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <h3>Test Results Distribution</h3>
          <div class="chart-container">
            <canvas id="resultsChart"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <h3>Duration Distribution</h3>
          <div class="chart-container">
            <canvas id="durationChart"></canvas>
          </div>
        </div>
      </div>
    </section>

    <!-- API Health Section -->
    <section id="apis">
      <h2>🏥 API Health Dashboard <span class="badge">${data.apis.size} APIs</span></h2>
      <div class="api-grid">
        ${apiArray.map(api => {
          const healthClass = api.healthScore === 100 ? 'excellent' : api.healthScore >= 90 ? 'good' : api.healthScore >= 70 ? 'warning' : 'critical';
          return `
        <div class="api-card" onclick="scrollToFile('${api.name}')">
          <div class="api-header">
            <div class="api-name">${api.name}</div>
            <div class="api-health ${healthClass}">${api.healthScore}%</div>
          </div>
          <div class="api-stats">
            <div class="stat">
              <div class="stat-value" style="color: var(--success)">${api.passed}</div>
              <div class="stat-label">Passed</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: var(--failure)">${api.failed}</div>
              <div class="stat-label">Failed</div>
            </div>
            <div class="stat">
              <div class="stat-value">${api.totalTests}</div>
              <div class="stat-label">Total</div>
            </div>
          </div>
          <div class="api-timing">
            <span>Avg: ${formatDuration(api.avgDuration)}</span>
            <span>Max: ${formatDuration(api.maxDuration)}</span>
          </div>
        </div>`;
        }).join('')}
      </div>
    </section>

    <!-- Categories Section -->
    <section id="categories">
      <h2>📁 Test Categories <span class="badge">${categoryArray.length} categories</span></h2>
      <div class="category-pills">
        ${categoryArray.map(cat => `
        <div class="category-pill" onclick="filterByCategory('${cat.name}')">
          <span class="icon">${cat.icon}</span>
          <span>${cat.name}</span>
          <span class="count ${cat.failed > 0 ? 'has-failures' : ''}">${cat.total}</span>
        </div>
        `).join('')}
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <h3>Tests by Category</h3>
          <div class="chart-container">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <h3>API Test Coverage</h3>
          <div class="chart-container">
            <canvas id="apiChart"></canvas>
          </div>
        </div>
      </div>
    </section>

    <!-- Performance Section -->
    <section id="performance">
      <h2>⚡ Performance Metrics</h2>
      <div class="perf-grid">
        <div class="perf-metric">
          <div class="label">Average</div>
          <div class="value">${formatDuration(data.performanceMetrics.avgDuration)}</div>
        </div>
        <div class="perf-metric">
          <div class="label">P50 (Median)</div>
          <div class="value">${formatDuration(data.performanceMetrics.p50)}</div>
        </div>
        <div class="perf-metric">
          <div class="label">P90</div>
          <div class="value">${formatDuration(data.performanceMetrics.p90)}</div>
        </div>
        <div class="perf-metric">
          <div class="label">P95</div>
          <div class="value">${formatDuration(data.performanceMetrics.p95)}</div>
        </div>
        <div class="perf-metric">
          <div class="label">P99</div>
          <div class="value">${formatDuration(data.performanceMetrics.p99)}</div>
        </div>
        <div class="perf-metric">
          <div class="label">Max</div>
          <div class="value">${formatDuration(data.performanceMetrics.maxDuration)}</div>
        </div>
      </div>
    </section>

    <!-- Failed Tests Section -->
    ${data.failedTests.length > 0 ? `
    <section id="failed">
      <h2>❌ Failed Tests <span class="badge">${data.failedTests.length} failures</span></h2>
      <div class="failed-section">
        <div class="failed-header">
          <span>⚠️</span>
          <span>${data.failedTests.length} test${data.failedTests.length > 1 ? 's' : ''} failed</span>
        </div>
        ${data.failedTests.map(test => `
        <div class="failed-item">
          <div class="failed-item-header">
            <div>
              <div class="failed-item-name">${escapeHtml(test.name)}</div>
              <div class="failed-item-file">${test.file}</div>
            </div>
            <div style="color: var(--muted); font-size: 0.75rem;">${formatDuration(test.duration)}</div>
          </div>
          ${test.error ? `<div class="failed-item-error">${escapeHtml(test.error)}</div>` : ''}
        </div>
        `).join('')}
      </div>
    </section>
    ` : ''}

    <!-- Slowest Tests Section -->
    <section id="slowest">
      <h2>🐢 Slowest Tests <span class="badge">Top 20</span></h2>
      <div class="slowest-list">
        ${data.slowestTests.slice(0, 20).map((test, i) => `
        <div class="slowest-item">
          <span class="slowest-rank">#${i + 1}</span>
          <span class="slowest-name" title="${escapeHtml(test.name)}">${escapeHtml(test.name)}</span>
          <span class="slowest-duration">${formatDuration(test.duration)}</span>
        </div>
        `).join('')}
      </div>
    </section>

    <!-- All Tests Section -->
    <section id="all-tests">
      <h2>📋 All Tests <span class="badge">${data.totalTests} tests</span></h2>

      <div class="filters">
        <input type="text" class="search-box" id="searchBox" placeholder="Search tests by name, file, or category..." onkeyup="filterTests()">
        <button class="filter-btn active" data-filter="all" onclick="setFilter('all', this)">All (${data.totalTests})</button>
        <button class="filter-btn" data-filter="passed" onclick="setFilter('passed', this)">✓ Passed (${data.passed})</button>
        <button class="filter-btn" data-filter="failed" onclick="setFilter('failed', this)">✗ Failed (${data.failed})</button>
        ${data.skipped > 0 ? `<button class="filter-btn" data-filter="skipped" onclick="setFilter('skipped', this)">⊘ Skipped (${data.skipped})</button>` : ''}
        <button class="filter-btn" onclick="expandAll()">Expand All</button>
        <button class="filter-btn" onclick="collapseAll()">Collapse All</button>
      </div>

      <div id="testFiles">
        ${data.files.map(file => `
        <div class="test-file ${file.failed > 0 ? 'has-failures' : 'all-passed'}" data-file="${file.path}" data-passed="${file.passed}" data-failed="${file.failed}" data-skipped="${file.skipped}">
          <div class="test-file-header" onclick="this.parentElement.classList.toggle('expanded')">
            <div class="test-file-info">
              <span class="test-file-icon">${file.failed > 0 ? '❌' : '✅'}</span>
              <span class="test-file-name" title="${file.path}">${file.name}</span>
            </div>
            <div class="test-file-stats">
              <span class="passed">✓ ${file.passed}</span>
              <span class="failed">✗ ${file.failed}</span>
              <span class="duration">⏱ ${formatDuration(file.totalDuration)}</span>
              <span class="expand-icon">▼</span>
            </div>
          </div>
          <div class="test-cases">
            ${file.tests.map(test => `
            <div class="test-case ${test.status}" data-status="${test.status}" data-name="${escapeHtml(test.name).toLowerCase()}" data-category="${test.category?.toLowerCase() || ''}">
              <span class="test-case-icon ${test.status === 'passed' ? 'pass' : test.status === 'failed' ? 'fail' : 'skip'}">
                ${test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '⊘'}
              </span>
              <div class="test-case-content">
                <div class="test-case-name">${escapeHtml(test.name)}</div>
                <div class="test-case-meta">
                  <span>⏱ ${formatDuration(test.duration)}</span>
                  ${test.category ? `<span>📁 ${test.category}</span>` : ''}
                </div>
                ${test.error ? `<div class="test-case-error">${escapeHtml(test.error)}</div>` : ''}
              </div>
            </div>
            `).join('')}
          </div>
        </div>
        `).join('')}
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>Generated by E2E Test Report Generator • ${new Date(data.timestamp).toLocaleString()}</p>
      <p>pdeservice-spb • ${data.gitBranch}@${data.gitCommit}</p>
    </footer>
  </div>

  <script>
    // Chart.js setup
    const chartColors = {
      success: '#22c55e',
      failure: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
      purple: '#8b5cf6',
    };

    // Results Pie Chart
    new Chart(document.getElementById('resultsChart'), {
      type: 'doughnut',
      data: {
        labels: ['Passed', 'Failed', 'Skipped'],
        datasets: [{
          data: [${data.passed}, ${data.failed}, ${data.skipped}],
          backgroundColor: [chartColors.success, chartColors.failure, chartColors.warning],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        cutout: '60%',
      }
    });

    // Duration Distribution Chart
    new Chart(document.getElementById('durationChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(data.durationDistribution.map(d => d.range))},
        datasets: [{
          label: 'Tests',
          data: ${JSON.stringify(data.durationDistribution.map(d => d.count))},
          backgroundColor: chartColors.info,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { display: false } },
          x: { grid: { display: false } }
        }
      }
    });

    // Category Chart
    new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(categoryArray.map(c => c.name))},
        datasets: [
          { label: 'Passed', data: ${JSON.stringify(categoryArray.map(c => c.passed))}, backgroundColor: chartColors.success, borderRadius: 4 },
          { label: 'Failed', data: ${JSON.stringify(categoryArray.map(c => c.failed))}, backgroundColor: chartColors.failure, borderRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { display: false } }
        }
      }
    });

    // API Chart
    new Chart(document.getElementById('apiChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(apiArray.slice(0, 15).map(a => a.name.replace('api-', '')))},
        datasets: [{
          label: 'Tests',
          data: ${JSON.stringify(apiArray.slice(0, 15).map(a => a.totalTests))},
          backgroundColor: ${JSON.stringify(apiArray.slice(0, 15).map(a => a.healthScore === 100 ? chartColors.success : a.healthScore >= 90 ? chartColors.info : a.healthScore >= 70 ? chartColors.warning : chartColors.failure))},
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { display: false } },
          y: { grid: { display: false } }
        }
      }
    });

    // Filter functions
    let currentFilter = 'all';

    function setFilter(filter, btn) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTests();
    }

    function filterTests() {
      const search = document.getElementById('searchBox').value.toLowerCase();
      document.querySelectorAll('.test-file').forEach(file => {
        let hasVisible = false;
        file.querySelectorAll('.test-case').forEach(test => {
          const name = test.dataset.name;
          const status = test.dataset.status;
          const category = test.dataset.category;
          const matchesSearch = !search || name.includes(search) || category.includes(search);
          const matchesFilter = currentFilter === 'all' || status === currentFilter;
          const visible = matchesSearch && matchesFilter;
          test.style.display = visible ? '' : 'none';
          if (visible) hasVisible = true;
        });
        file.style.display = hasVisible ? '' : 'none';
      });
    }

    function expandAll() {
      document.querySelectorAll('.test-file').forEach(f => f.classList.add('expanded'));
    }

    function collapseAll() {
      document.querySelectorAll('.test-file').forEach(f => f.classList.remove('expanded'));
    }

    function scrollToFile(apiName) {
      const file = document.querySelector(\`.test-file[data-file*="\${apiName}"]\`);
      if (file) {
        file.scrollIntoView({ behavior: 'smooth', block: 'center' });
        file.classList.add('expanded');
      }
    }

    function filterByCategory(category) {
      document.getElementById('searchBox').value = category.toLowerCase();
      filterTests();
      document.getElementById('all-tests').scrollIntoView({ behavior: 'smooth' });
    }

    // Navigation highlighting
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav a');

    window.addEventListener('scroll', () => {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (scrollY >= sectionTop) current = section.id;
      });
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) link.classList.add('active');
      });
    });

    // Auto-expand failed files
    document.querySelectorAll('.test-file.has-failures').forEach(f => f.classList.add('expanded'));
  </script>
</body>
</html>`;
}

// Main
async function main() {
  const args = parseArgs(Deno.args);
  const inputFile = args._[0] as string || '/tmp/e2e-test-output.txt';
  const outputFile = args._[1] as string || 'coverage/e2e-report.html';

  console.log(`Reading test output from: ${inputFile}`);
  const content = await Deno.readTextFile(inputFile);

  console.log('Parsing test results...');
  const results = parseTestOutput(content);
  console.log(`Found ${results.length} test results`);

  console.log('Generating report data...');
  const data = generateReportData(results);

  // Add environment info
  const envInfo = await getEnvironmentInfo();
  data.gitBranch = envInfo.gitBranch;
  data.gitCommit = envInfo.gitCommit;
  data.denoVersion = envInfo.denoVersion;
  data.supabaseVersion = envInfo.supabaseVersion;

  console.log('Generating HTML...');
  const html = generateHTML(data);

  // Ensure output directory exists
  const outputDir = outputFile.split('/').slice(0, -1).join('/');
  if (outputDir) {
    await Deno.mkdir(outputDir, { recursive: true });
  }

  await Deno.writeTextFile(outputFile, html);
  console.log(`Report generated: ${outputFile}`);

  // Print summary
  console.log('\n--- Summary ---');
  console.log(`Total: ${data.totalTests} | Passed: ${data.passed} | Failed: ${data.failed} | Skipped: ${data.skipped}`);
  console.log(`Pass Rate: ${data.passRate}%`);
  console.log(`Duration: ${Math.round(data.totalDuration / 1000)}s`);
}

main().catch(console.error);
