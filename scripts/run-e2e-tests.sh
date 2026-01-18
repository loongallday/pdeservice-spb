#!/bin/bash
# ==============================================
# E2E Test Runner
# ==============================================
# Runs complete E2E test suite with automatic setup
# Generates HTML summary report in coverage/e2e-report.html
#
# Usage: ./scripts/run-e2e-tests.sh [test-pattern]
#
# Examples:
#   ./scripts/run-e2e-tests.sh                    # Run all E2E tests
#   ./scripts/run-e2e-tests.sh tickets            # Run only ticket tests
#   ./scripts/run-e2e-tests.sh employees          # Run only employee tests
# ==============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FUNCTIONS_PORT=54321
FUNCTIONS_PID_FILE="/tmp/supabase-functions.pid"
TEST_PATTERN="${1:-}"
REPORT_DIR="coverage"
REPORT_FILE="$REPORT_DIR/e2e-report.html"
TEST_OUTPUT_FILE="/tmp/e2e-test-output.txt"

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ==============================================
# Generate HTML Report
# ==============================================
generate_html_report() {
  local test_output="$1"
  local exit_code="$2"
  local start_time="$3"
  local end_time="$4"

  # Parse test results from output (handle ANSI color codes)
  # Strip ANSI codes first - use perl for macOS compatibility (BSD sed doesn't support \x1b)
  local stripped_file="/tmp/e2e-test-stripped.txt"
  perl -pe 's/\e\[[0-9;]*m//g' "$test_output" > "$stripped_file"

  # Count passed tests (format: "... ok (")
  local passed_tests=$(grep -E '\.\.\.[ ]+ok[ ]+\(' "$stripped_file" 2>/dev/null | wc -l | tr -d ' ')
  passed_tests=${passed_tests:-0}

  # Count failed tests (format: "... FAILED")
  local failed_tests=$(grep -E '\.\.\.[ ]+FAILED' "$stripped_file" 2>/dev/null | wc -l | tr -d ' ')
  failed_tests=${failed_tests:-0}

  # Count ignored/skipped tests
  local skipped_tests=$(grep -E '\.\.\.[ ]+ignored' "$stripped_file" 2>/dev/null | wc -l | tr -d ' ')
  skipped_tests=${skipped_tests:-0}

  local total_tests=$((passed_tests + failed_tests + skipped_tests))
  local duration=$((end_time - start_time))

  # Get environment info
  local deno_version=$(deno --version 2>/dev/null | head -1 || echo "unknown")
  local supabase_version=$(supabase --version 2>/dev/null || echo "unknown")
  local node_version=$(node --version 2>/dev/null || echo "N/A")
  local git_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
  local git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

  # Determine overall status
  local status_class="success"
  local status_text="PASSED"
  if [ "$exit_code" -ne 0 ]; then
    status_class="failure"
    status_text="FAILED"
  fi

  # Create report directory
  mkdir -p "$REPORT_DIR"

  # Generate HTML
  cat > "$REPORT_FILE" << 'HTMLHEAD'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report - pdeservice-spb</title>
  <style>
    :root {
      --success-color: #22c55e;
      --success-bg: #dcfce7;
      --failure-color: #ef4444;
      --failure-bg: #fee2e2;
      --warning-color: #f59e0b;
      --warning-bg: #fef3c7;
      --info-color: #3b82f6;
      --info-bg: #dbeafe;
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --text-color: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --code-bg: #1e293b;
      --code-color: #e2e8f0;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #0f172a;
        --card-bg: #1e293b;
        --text-color: #f1f5f9;
        --text-muted: #94a3b8;
        --border-color: #334155;
        --code-bg: #0f172a;
        --code-color: #e2e8f0;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
    .header-left h1 { font-size: 1.875rem; margin-bottom: 0.25rem; }
    .header-left .subtitle { color: var(--text-muted); }
    .header-right { text-align: right; }
    .env-info { font-size: 0.75rem; color: var(--text-muted); font-family: monospace; }
    .env-info div { margin-bottom: 0.25rem; }

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card-bg);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid var(--border-color);
    }
    .card-label { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-value { font-size: 1.75rem; font-weight: 700; }
    .card-value.success { color: var(--success-color); }
    .card-value.failure { color: var(--failure-color); }
    .card-value.warning { color: var(--warning-color); }
    .card-value.info { color: var(--info-color); }
    .status-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
      text-transform: uppercase;
    }
    .status-badge.success { background: var(--success-bg); color: #166534; }
    .status-badge.failure { background: var(--failure-bg); color: #991b1b; }
    .progress-bar {
      height: 0.5rem;
      background: var(--border-color);
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 0.75rem;
    }
    .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }
    .progress-fill.success { background: var(--success-color); }
    .progress-fill.failure { background: var(--failure-color); }

    /* Chart Section */
    .chart-section {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .chart-section h2 { font-size: 1rem; margin-bottom: 1rem; }
    .donut-chart {
      display: flex;
      align-items: center;
      gap: 2rem;
      flex-wrap: wrap;
    }
    .donut-container { position: relative; width: 150px; height: 150px; }
    .donut-container svg { transform: rotate(-90deg); }
    .donut-center {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    .donut-center .value { font-size: 1.5rem; font-weight: 700; }
    .donut-center .label { font-size: 0.75rem; color: var(--text-muted); }
    .chart-legend { display: flex; flex-direction: column; gap: 0.5rem; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    .legend-color { width: 12px; height: 12px; border-radius: 2px; }
    .legend-color.passed { background: var(--success-color); }
    .legend-color.failed { background: var(--failure-color); }
    .legend-color.skipped { background: var(--warning-color); }

    /* Filters and Search */
    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-box {
      flex: 1;
      min-width: 200px;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: var(--card-bg);
      color: var(--text-color);
      font-size: 0.875rem;
    }
    .search-box:focus { outline: none; border-color: var(--info-color); }
    .filter-btn {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: var(--card-bg);
      color: var(--text-color);
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    }
    .filter-btn:hover { background: var(--border-color); }
    .filter-btn.active { background: var(--info-color); color: white; border-color: var(--info-color); }
    .filter-btn.passed.active { background: var(--success-color); border-color: var(--success-color); }
    .filter-btn.failed.active { background: var(--failure-color); border-color: var(--failure-color); }
    .filter-btn.skipped.active { background: var(--warning-color); border-color: var(--warning-color); }

    /* Test Results */
    .test-results { margin-top: 1rem; }
    .test-results h2 { font-size: 1.125rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .test-count-badge { font-size: 0.75rem; padding: 0.25rem 0.5rem; background: var(--border-color); border-radius: 9999px; }

    .test-file {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      margin-bottom: 0.75rem;
      overflow: hidden;
    }
    .test-file.has-failures { border-left: 3px solid var(--failure-color); }
    .test-file.all-passed { border-left: 3px solid var(--success-color); }
    .test-file-header {
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      background: var(--card-bg);
      transition: background 0.2s;
    }
    .test-file-header:hover { background: var(--border-color); }
    .test-file-info { display: flex; align-items: center; gap: 1rem; flex: 1; }
    .test-file-icon { font-size: 1.25rem; }
    .test-file-name { font-weight: 500; font-family: monospace; font-size: 0.875rem; }
    .test-file-meta { font-size: 0.75rem; color: var(--text-muted); }
    .test-file-stats { display: flex; gap: 0.75rem; font-size: 0.875rem; }
    .test-file-stats span { display: flex; align-items: center; gap: 0.25rem; }
    .test-file-stats .passed { color: var(--success-color); }
    .test-file-stats .failed { color: var(--failure-color); }
    .test-file-stats .skipped { color: var(--warning-color); }
    .test-file-stats .duration { color: var(--text-muted); }
    .expand-icon { transition: transform 0.2s; color: var(--text-muted); }
    .test-file.expanded .expand-icon { transform: rotate(180deg); }

    .test-cases { display: none; border-top: 1px solid var(--border-color); }
    .test-file.expanded .test-cases { display: block; }

    .test-case {
      padding: 0.75rem 1.25rem 0.75rem 3rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      font-size: 0.875rem;
    }
    .test-case:last-child { border-bottom: none; }
    .test-case.passed { background: rgba(34, 197, 94, 0.05); }
    .test-case.failed { background: rgba(239, 68, 68, 0.05); }
    .test-case.skipped { background: rgba(245, 158, 11, 0.05); }

    .test-status-icon { flex-shrink: 0; font-size: 1rem; }
    .test-status-icon.pass { color: var(--success-color); }
    .test-status-icon.fail { color: var(--failure-color); }
    .test-status-icon.skip { color: var(--warning-color); }

    .test-case-content { flex: 1; min-width: 0; }
    .test-case-name { font-family: monospace; word-break: break-word; }
    .test-case-duration { color: var(--text-muted); font-size: 0.75rem; margin-top: 0.25rem; }

    /* Error Details */
    .error-section {
      background: var(--card-bg);
      border: 1px solid var(--failure-color);
      border-radius: 0.75rem;
      margin-top: 2rem;
      overflow: hidden;
    }
    .error-section-header {
      background: var(--failure-bg);
      padding: 1rem 1.25rem;
      font-weight: 600;
      color: #991b1b;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .error-item {
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 1.25rem;
    }
    .error-item:last-child { border-bottom: none; }
    .error-test-name { font-weight: 500; margin-bottom: 0.5rem; font-family: monospace; font-size: 0.875rem; }
    .error-message {
      background: var(--code-bg);
      color: var(--code-color);
      padding: 1rem;
      border-radius: 0.5rem;
      font-family: monospace;
      font-size: 0.75rem;
      white-space: pre-wrap;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }
    .error-message .line-error { color: #f87171; }
    .error-message .line-info { color: #60a5fa; }
    .error-message .line-file { color: #a78bfa; }

    /* Raw Output Section */
    .raw-output-section {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      margin-top: 2rem;
      overflow: hidden;
    }
    .raw-output-header {
      padding: 1rem 1.25rem;
      background: var(--border-color);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
    }
    .raw-output-content {
      display: none;
      padding: 1rem;
      background: var(--code-bg);
      color: var(--code-color);
      font-family: monospace;
      font-size: 0.7rem;
      white-space: pre-wrap;
      max-height: 500px;
      overflow: auto;
    }
    .raw-output-section.expanded .raw-output-content { display: block; }

    /* Slowest Tests */
    .slowest-tests {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      padding: 1.25rem;
      margin-top: 2rem;
    }
    .slowest-tests h3 { font-size: 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .slow-test-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.875rem;
    }
    .slow-test-item:last-child { border-bottom: none; }
    .slow-test-name { font-family: monospace; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .slow-test-duration {
      font-weight: 600;
      color: var(--warning-color);
      padding: 0.25rem 0.5rem;
      background: var(--warning-bg);
      border-radius: 0.25rem;
      font-size: 0.75rem;
    }

    /* Footer */
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    /* Utility */
    .hidden { display: none !important; }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .test-file { animation: fadeIn 0.3s ease; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>🧪 E2E Test Report</h1>
        <p class="subtitle">pdeservice-spb - End-to-End Test Results</p>
      </div>
      <div class="header-right">
        <div class="env-info">
HTMLHEAD

  # Add environment info
  echo "          <div><strong>Branch:</strong> $git_branch @ $git_commit</div>" >> "$REPORT_FILE"
  echo "          <div><strong>Deno:</strong> $deno_version</div>" >> "$REPORT_FILE"
  echo "          <div><strong>Supabase:</strong> $supabase_version</div>" >> "$REPORT_FILE"
  echo "          <div><strong>Date:</strong> $(date '+%Y-%m-%d %H:%M:%S')</div>" >> "$REPORT_FILE"

  cat >> "$REPORT_FILE" << 'HTMLENV'
        </div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="card">
        <div class="card-label">Status</div>
HTMLENV

  # Add dynamic status
  echo "        <div class=\"card-value\"><span class=\"status-badge $status_class\">$status_text</span></div>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"

  echo "      <div class=\"card\">" >> "$REPORT_FILE"
  echo "        <div class=\"card-label\">Total Tests</div>" >> "$REPORT_FILE"
  echo "        <div class=\"card-value info\">$total_tests</div>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"

  echo "      <div class=\"card\">" >> "$REPORT_FILE"
  echo "        <div class=\"card-label\">Passed</div>" >> "$REPORT_FILE"
  echo "        <div class=\"card-value success\">$passed_tests</div>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"

  echo "      <div class=\"card\">" >> "$REPORT_FILE"
  echo "        <div class=\"card-label\">Failed</div>" >> "$REPORT_FILE"
  echo "        <div class=\"card-value failure\">$failed_tests</div>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"

  echo "      <div class=\"card\">" >> "$REPORT_FILE"
  echo "        <div class=\"card-label\">Skipped</div>" >> "$REPORT_FILE"
  echo "        <div class=\"card-value warning\">$skipped_tests</div>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"

  echo "      <div class=\"card\">" >> "$REPORT_FILE"
  echo "        <div class=\"card-label\">Duration</div>" >> "$REPORT_FILE"
  local minutes=$((duration / 60))
  local seconds=$((duration % 60))
  if [ $minutes -gt 0 ]; then
    echo "        <div class=\"card-value\">${minutes}m ${seconds}s</div>" >> "$REPORT_FILE"
  else
    echo "        <div class=\"card-value\">${seconds}s</div>" >> "$REPORT_FILE"
  fi
  echo "      </div>" >> "$REPORT_FILE"

  # Calculate pass rate
  local pass_rate=0
  if [ "$total_tests" -gt 0 ]; then
    pass_rate=$((passed_tests * 100 / total_tests))
  fi

  echo "      <div class=\"card\">" >> "$REPORT_FILE"
  echo "        <div class=\"card-label\">Pass Rate</div>" >> "$REPORT_FILE"
  echo "        <div class=\"card-value\">${pass_rate}%</div>" >> "$REPORT_FILE"
  local progress_class="success"
  if [ $pass_rate -lt 100 ]; then
    progress_class="failure"
  fi
  echo "        <div class=\"progress-bar\"><div class=\"progress-fill $progress_class\" style=\"width: ${pass_rate}%\"></div></div>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"
  echo "    </div>" >> "$REPORT_FILE"

  # Chart Section
  echo "    <div class=\"chart-section\">" >> "$REPORT_FILE"
  echo "      <h2>Test Distribution</h2>" >> "$REPORT_FILE"
  echo "      <div class=\"donut-chart\">" >> "$REPORT_FILE"
  echo "        <div class=\"donut-container\">" >> "$REPORT_FILE"

  # Calculate SVG donut chart
  local radius=60
  local circumference=$((2 * 314 * radius / 100))
  local passed_pct=0
  local failed_pct=0
  local skipped_pct=0
  if [ "$total_tests" -gt 0 ]; then
    passed_pct=$((passed_tests * 100 / total_tests))
    failed_pct=$((failed_tests * 100 / total_tests))
    skipped_pct=$((skipped_tests * 100 / total_tests))
  fi
  local passed_dash=$((circumference * passed_pct / 100))
  local failed_dash=$((circumference * failed_pct / 100))
  local skipped_dash=$((circumference * skipped_pct / 100))
  local passed_offset=0
  local failed_offset=$((passed_dash))
  local skipped_offset=$((passed_dash + failed_dash))

  echo "          <svg width=\"150\" height=\"150\" viewBox=\"0 0 150 150\">" >> "$REPORT_FILE"
  echo "            <circle cx=\"75\" cy=\"75\" r=\"$radius\" fill=\"none\" stroke=\"var(--border-color)\" stroke-width=\"15\"/>" >> "$REPORT_FILE"
  if [ "$passed_pct" -gt 0 ]; then
    echo "            <circle cx=\"75\" cy=\"75\" r=\"$radius\" fill=\"none\" stroke=\"var(--success-color)\" stroke-width=\"15\" stroke-dasharray=\"$passed_dash $circumference\" stroke-dashoffset=\"-$passed_offset\"/>" >> "$REPORT_FILE"
  fi
  if [ "$failed_pct" -gt 0 ]; then
    echo "            <circle cx=\"75\" cy=\"75\" r=\"$radius\" fill=\"none\" stroke=\"var(--failure-color)\" stroke-width=\"15\" stroke-dasharray=\"$failed_dash $circumference\" stroke-dashoffset=\"-$failed_offset\"/>" >> "$REPORT_FILE"
  fi
  if [ "$skipped_pct" -gt 0 ]; then
    echo "            <circle cx=\"75\" cy=\"75\" r=\"$radius\" fill=\"none\" stroke=\"var(--warning-color)\" stroke-width=\"15\" stroke-dasharray=\"$skipped_dash $circumference\" stroke-dashoffset=\"-$skipped_offset\"/>" >> "$REPORT_FILE"
  fi
  echo "          </svg>" >> "$REPORT_FILE"
  echo "          <div class=\"donut-center\">" >> "$REPORT_FILE"
  echo "            <div class=\"value\">${pass_rate}%</div>" >> "$REPORT_FILE"
  echo "            <div class=\"label\">Pass Rate</div>" >> "$REPORT_FILE"
  echo "          </div>" >> "$REPORT_FILE"
  echo "        </div>" >> "$REPORT_FILE"
  echo "        <div class=\"chart-legend\">" >> "$REPORT_FILE"
  echo "          <div class=\"legend-item\"><div class=\"legend-color passed\"></div> Passed: $passed_tests ($passed_pct%)</div>" >> "$REPORT_FILE"
  echo "          <div class=\"legend-item\"><div class=\"legend-color failed\"></div> Failed: $failed_tests ($failed_pct%)</div>" >> "$REPORT_FILE"
  echo "          <div class=\"legend-item\"><div class=\"legend-color skipped\"></div> Skipped: $skipped_tests ($skipped_pct%)</div>" >> "$REPORT_FILE"
  echo "        </div>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"
  echo "    </div>" >> "$REPORT_FILE"

  # Filters
  echo "    <div class=\"filters\">" >> "$REPORT_FILE"
  echo "      <input type=\"text\" class=\"search-box\" id=\"searchBox\" placeholder=\"Search tests...\" onkeyup=\"filterTests()\">" >> "$REPORT_FILE"
  echo "      <button class=\"filter-btn active\" data-filter=\"all\" onclick=\"setFilter('all', this)\">All ($total_tests)</button>" >> "$REPORT_FILE"
  echo "      <button class=\"filter-btn passed\" data-filter=\"passed\" onclick=\"setFilter('passed', this)\">✓ Passed ($passed_tests)</button>" >> "$REPORT_FILE"
  echo "      <button class=\"filter-btn failed\" data-filter=\"failed\" onclick=\"setFilter('failed', this)\">✗ Failed ($failed_tests)</button>" >> "$REPORT_FILE"
  if [ "$skipped_tests" -gt 0 ]; then
    echo "      <button class=\"filter-btn skipped\" data-filter=\"skipped\" onclick=\"setFilter('skipped', this)\">⊘ Skipped ($skipped_tests)</button>" >> "$REPORT_FILE"
  fi
  echo "      <button class=\"filter-btn\" onclick=\"expandAll()\">Expand All</button>" >> "$REPORT_FILE"
  echo "      <button class=\"filter-btn\" onclick=\"collapseAll()\">Collapse All</button>" >> "$REPORT_FILE"
  echo "    </div>" >> "$REPORT_FILE"

  # Test Results by File
  echo "    <div class=\"test-results\">" >> "$REPORT_FILE"
  echo "      <h2>Test Results <span class=\"test-count-badge\">$total_tests tests</span></h2>" >> "$REPORT_FILE"

  # Create temp files for test data
  local test_data_file="/tmp/e2e-test-data.txt"
  > "$test_data_file"

  # Parse test output line by line and extract all test data
  local in_error_block=0
  local current_error=""
  local current_test=""

  # First pass: collect all tests with their status and duration
  while IFS= read -r line; do
    # Match test result lines: "test_name ... ok (XXms)" or "test_name ... FAILED (XXms)"
    if [[ "$line" =~ ^(.+)\ \.\.\.\ +(ok|FAILED|ignored)\ +\(([0-9]+)ms\) ]]; then
      local test_name="${BASH_REMATCH[1]}"
      local status="${BASH_REMATCH[2]}"
      local duration="${BASH_REMATCH[3]}"

      # Normalize status
      case "$status" in
        "ok") status="passed" ;;
        "FAILED") status="failed" ;;
        "ignored") status="skipped" ;;
      esac

      echo "${status}|${duration}|${test_name}" >> "$test_data_file"
    fi
  done < "$stripped_file"

  # Group tests by file and output HTML
  local current_file=""
  local file_tests=""
  local file_passed=0
  local file_failed=0
  local file_skipped=0
  local file_duration=0
  local all_slowest=""

  sort -t'|' -k3 "$test_data_file" | while IFS='|' read -r status duration test_name; do
    # Extract file from test name
    local file_match=$(echo "$test_name" | grep -oE 'tests/e2e/[^/]+\.test\.ts' | head -1)
    if [ -z "$file_match" ]; then
      file_match="Other Tests"
    fi

    # If we have a new file, output the previous one
    if [ "$current_file" != "$file_match" ] && [ -n "$current_file" ]; then
      local file_class="all-passed"
      if [ "$file_failed" -gt 0 ]; then
        file_class="has-failures"
      fi

      echo "      <div class=\"test-file $file_class\" data-passed=\"$file_passed\" data-failed=\"$file_failed\" data-skipped=\"$file_skipped\">" >> "$REPORT_FILE"
      echo "        <div class=\"test-file-header\" onclick=\"this.parentElement.classList.toggle('expanded')\">" >> "$REPORT_FILE"
      echo "          <div class=\"test-file-info\">" >> "$REPORT_FILE"
      local file_icon="📄"
      if [ "$file_failed" -gt 0 ]; then
        file_icon="❌"
      elif [ "$file_passed" -gt 0 ]; then
        file_icon="✅"
      fi
      echo "            <span class=\"test-file-icon\">$file_icon</span>" >> "$REPORT_FILE"
      echo "            <div>" >> "$REPORT_FILE"
      echo "              <div class=\"test-file-name\">$current_file</div>" >> "$REPORT_FILE"
      echo "              <div class=\"test-file-meta\">$((file_passed + file_failed + file_skipped)) tests · ${file_duration}ms</div>" >> "$REPORT_FILE"
      echo "            </div>" >> "$REPORT_FILE"
      echo "          </div>" >> "$REPORT_FILE"
      echo "          <div class=\"test-file-stats\">" >> "$REPORT_FILE"
      echo "            <span class=\"passed\">✓ $file_passed</span>" >> "$REPORT_FILE"
      if [ "$file_failed" -gt 0 ]; then
        echo "            <span class=\"failed\">✗ $file_failed</span>" >> "$REPORT_FILE"
      fi
      if [ "$file_skipped" -gt 0 ]; then
        echo "            <span class=\"skipped\">⊘ $file_skipped</span>" >> "$REPORT_FILE"
      fi
      echo "            <span class=\"expand-icon\">▼</span>" >> "$REPORT_FILE"
      echo "          </div>" >> "$REPORT_FILE"
      echo "        </div>" >> "$REPORT_FILE"
      echo "        <div class=\"test-cases\">$file_tests</div>" >> "$REPORT_FILE"
      echo "      </div>" >> "$REPORT_FILE"

      file_tests=""
      file_passed=0
      file_failed=0
      file_skipped=0
      file_duration=0
    fi

    current_file="$file_match"
    file_duration=$((file_duration + duration))

    # Build test case HTML
    local status_icon="✓"
    local status_class="pass"
    local case_class="passed"
    case "$status" in
      "passed")
        status_icon="✓"
        status_class="pass"
        case_class="passed"
        file_passed=$((file_passed + 1))
        ;;
      "failed")
        status_icon="✗"
        status_class="fail"
        case_class="failed"
        file_failed=$((file_failed + 1))
        ;;
      "skipped")
        status_icon="⊘"
        status_class="skip"
        case_class="skipped"
        file_skipped=$((file_skipped + 1))
        ;;
    esac

    # Clean test name for display
    local display_name=$(echo "$test_name" | sed 's/tests\/e2e\/[^/]*\.test\.ts > //')

    file_tests="$file_tests<div class=\"test-case $case_class\" data-status=\"$status\" data-name=\"$(echo "$test_name" | sed 's/"/\&quot;/g')\"><span class=\"test-status-icon $status_class\">$status_icon</span><div class=\"test-case-content\"><div class=\"test-case-name\">$display_name</div><div class=\"test-case-duration\">${duration}ms</div></div></div>"

    # Track for slowest tests
    all_slowest="$all_slowest$duration|$test_name\n"
  done

  # Output last file
  if [ -n "$current_file" ]; then
    local file_class="all-passed"
    if [ "$file_failed" -gt 0 ]; then
      file_class="has-failures"
    fi

    echo "      <div class=\"test-file $file_class\" data-passed=\"$file_passed\" data-failed=\"$file_failed\" data-skipped=\"$file_skipped\">" >> "$REPORT_FILE"
    echo "        <div class=\"test-file-header\" onclick=\"this.parentElement.classList.toggle('expanded')\">" >> "$REPORT_FILE"
    echo "          <div class=\"test-file-info\">" >> "$REPORT_FILE"
    local file_icon="📄"
    if [ "$file_failed" -gt 0 ]; then
      file_icon="❌"
    elif [ "$file_passed" -gt 0 ]; then
      file_icon="✅"
    fi
    echo "            <span class=\"test-file-icon\">$file_icon</span>" >> "$REPORT_FILE"
    echo "            <div>" >> "$REPORT_FILE"
    echo "              <div class=\"test-file-name\">$current_file</div>" >> "$REPORT_FILE"
    echo "              <div class=\"test-file-meta\">$((file_passed + file_failed + file_skipped)) tests · ${file_duration}ms</div>" >> "$REPORT_FILE"
    echo "            </div>" >> "$REPORT_FILE"
    echo "          </div>" >> "$REPORT_FILE"
    echo "          <div class=\"test-file-stats\">" >> "$REPORT_FILE"
    echo "            <span class=\"passed\">✓ $file_passed</span>" >> "$REPORT_FILE"
    if [ "$file_failed" -gt 0 ]; then
      echo "            <span class=\"failed\">✗ $file_failed</span>" >> "$REPORT_FILE"
    fi
    if [ "$file_skipped" -gt 0 ]; then
      echo "            <span class=\"skipped\">⊘ $file_skipped</span>" >> "$REPORT_FILE"
    fi
    echo "            <span class=\"expand-icon\">▼</span>" >> "$REPORT_FILE"
    echo "          </div>" >> "$REPORT_FILE"
    echo "        </div>" >> "$REPORT_FILE"
    echo "        <div class=\"test-cases\">$file_tests</div>" >> "$REPORT_FILE"
    echo "      </div>" >> "$REPORT_FILE"
  fi

  echo "    </div>" >> "$REPORT_FILE"

  # Slowest Tests Section
  echo "    <div class=\"slowest-tests\">" >> "$REPORT_FILE"
  echo "      <h3>🐢 Slowest Tests (Top 10)</h3>" >> "$REPORT_FILE"

  # Get top 10 slowest tests
  sort -t'|' -k1 -rn "$test_data_file" | head -10 | while IFS='|' read -r status duration test_name; do
    local display_name=$(echo "$test_name" | sed 's/tests\/e2e\///')
    echo "      <div class=\"slow-test-item\">" >> "$REPORT_FILE"
    echo "        <span class=\"slow-test-name\" title=\"$test_name\">$display_name</span>" >> "$REPORT_FILE"
    echo "        <span class=\"slow-test-duration\">${duration}ms</span>" >> "$REPORT_FILE"
    echo "      </div>" >> "$REPORT_FILE"
  done
  echo "    </div>" >> "$REPORT_FILE"

  # Error Details Section (if failures)
  if [ "$exit_code" -ne 0 ]; then
    echo "    <div class=\"error-section\">" >> "$REPORT_FILE"
    echo "      <div class=\"error-section-header\">❌ Error Details</div>" >> "$REPORT_FILE"

    # Extract detailed errors
    local in_error=0
    local error_test=""
    local error_content=""

    while IFS= read -r line; do
      # Detect start of error block
      if [[ "$line" =~ ^FAILURES ]]; then
        in_error=1
        continue
      fi

      if [ "$in_error" -eq 1 ]; then
        # New test failure
        if [[ "$line" =~ ^[[:space:]]*(.+)\ =\>\ (.+)\.test\.ts ]]; then
          # Output previous error if exists
          if [ -n "$error_test" ] && [ -n "$error_content" ]; then
            echo "      <div class=\"error-item\">" >> "$REPORT_FILE"
            echo "        <div class=\"error-test-name\">$error_test</div>" >> "$REPORT_FILE"
            echo "        <div class=\"error-message\">$(echo "$error_content" | sed 's/</\&lt;/g; s/>/\&gt;/g')</div>" >> "$REPORT_FILE"
            echo "      </div>" >> "$REPORT_FILE"
          fi
          error_test="$line"
          error_content=""
        elif [[ "$line" =~ ^error:|^AssertionError|^Error:|^[[:space:]]+at ]]; then
          error_content="$error_content$line
"
        fi
      fi
    done < "$stripped_file"

    # Output last error
    if [ -n "$error_test" ] && [ -n "$error_content" ]; then
      echo "      <div class=\"error-item\">" >> "$REPORT_FILE"
      echo "        <div class=\"error-test-name\">$error_test</div>" >> "$REPORT_FILE"
      echo "        <div class=\"error-message\">$(echo "$error_content" | sed 's/</\&lt;/g; s/>/\&gt;/g')</div>" >> "$REPORT_FILE"
      echo "      </div>" >> "$REPORT_FILE"
    fi

    # Fallback: show raw error grep if no structured errors found
    if [ -z "$error_content" ]; then
      echo "      <div class=\"error-item\">" >> "$REPORT_FILE"
      echo "        <div class=\"error-test-name\">Test Errors</div>" >> "$REPORT_FILE"
      echo "        <div class=\"error-message\">" >> "$REPORT_FILE"
      grep -A 20 "^FAILED\|^error:\|AssertionError\|Error:" "$stripped_file" 2>/dev/null | head -150 | sed 's/</\&lt;/g; s/>/\&gt;/g' >> "$REPORT_FILE"
      echo "        </div>" >> "$REPORT_FILE"
      echo "      </div>" >> "$REPORT_FILE"
    fi

    echo "    </div>" >> "$REPORT_FILE"
  fi

  # Raw Output Section
  echo "    <div class=\"raw-output-section\" id=\"rawOutput\">" >> "$REPORT_FILE"
  echo "      <div class=\"raw-output-header\" onclick=\"document.getElementById('rawOutput').classList.toggle('expanded')\">" >> "$REPORT_FILE"
  echo "        <span>📋 Raw Test Output</span>" >> "$REPORT_FILE"
  echo "        <span class=\"expand-icon\">▼</span>" >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"
  echo "      <div class=\"raw-output-content\">" >> "$REPORT_FILE"
  cat "$stripped_file" | sed 's/</\&lt;/g; s/>/\&gt;/g' >> "$REPORT_FILE"
  echo "      </div>" >> "$REPORT_FILE"
  echo "    </div>" >> "$REPORT_FILE"

  # Footer
  echo "    <div class=\"footer\">" >> "$REPORT_FILE"
  echo "      <div>Generated: $(date '+%Y-%m-%d %H:%M:%S') | Duration: ${minutes}m ${seconds}s</div>" >> "$REPORT_FILE"
  echo "      <div>pdeservice-spb E2E Test Suite</div>" >> "$REPORT_FILE"
  echo "    </div>" >> "$REPORT_FILE"

  # JavaScript for interactivity
  cat >> "$REPORT_FILE" << 'HTMLJS'
  </div>

  <script>
    let currentFilter = 'all';

    function setFilter(filter, btn) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTests();
    }

    function filterTests() {
      const searchTerm = document.getElementById('searchBox').value.toLowerCase();

      document.querySelectorAll('.test-file').forEach(file => {
        let hasVisibleTests = false;

        file.querySelectorAll('.test-case').forEach(test => {
          const status = test.dataset.status;
          const name = test.dataset.name.toLowerCase();

          const matchesFilter = currentFilter === 'all' || status === currentFilter;
          const matchesSearch = !searchTerm || name.includes(searchTerm);

          if (matchesFilter && matchesSearch) {
            test.classList.remove('hidden');
            hasVisibleTests = true;
          } else {
            test.classList.add('hidden');
          }
        });

        if (hasVisibleTests) {
          file.classList.remove('hidden');
        } else {
          file.classList.add('hidden');
        }
      });
    }

    function expandAll() {
      document.querySelectorAll('.test-file').forEach(f => f.classList.add('expanded'));
    }

    function collapseAll() {
      document.querySelectorAll('.test-file').forEach(f => f.classList.remove('expanded'));
    }

    // Auto-expand files with failures
    document.querySelectorAll('.test-file.has-failures').forEach(f => f.classList.add('expanded'));
  </script>
</body>
</html>
HTMLJS

  log_success "HTML report generated: $REPORT_FILE"
}

cleanup() {
  log_info "Cleaning up..."
  if [ -f "$FUNCTIONS_PID_FILE" ]; then
    FUNCTIONS_PID=$(cat "$FUNCTIONS_PID_FILE")
    if kill -0 "$FUNCTIONS_PID" 2>/dev/null; then
      log_info "Stopping functions server (PID: $FUNCTIONS_PID)..."
      kill "$FUNCTIONS_PID" 2>/dev/null || true
    fi
    rm -f "$FUNCTIONS_PID_FILE"
  fi
  # Also kill any orphaned deno processes from functions serve
  pkill -f "supabase.*functions.*serve" 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

# ==============================================
# Step 1: Check if Supabase is running
# ==============================================
log_info "Step 1: Checking Supabase status..."

if ! supabase status > /dev/null 2>&1; then
  log_warn "Supabase is not running. Starting..."
  supabase start
  sleep 5
fi

# Verify Supabase is accessible
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
  log_error "Supabase API is not accessible at localhost:54321"
  exit 1
fi

log_success "Supabase is running"

# ==============================================
# Step 2: Reset database with seed data
# ==============================================
log_info "Step 2: Resetting database with seed data..."

# Reset without seed (we'll seed manually)
supabase db reset --no-seed

# Seed reference data
log_info "Seeding reference data..."
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080000_seed_reference_data.sql > /dev/null

# Seed location data
log_info "Seeding location data..."
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080001_seed_location_data.sql > /dev/null

# Seed test data
log_info "Seeding test data..."
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080002_seed_test_data.sql > /dev/null

log_success "Database reset and seeded"

# ==============================================
# Step 3: Setup test auth users
# ==============================================
log_info "Step 3: Setting up test auth users..."

psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/seeds/20260118080003_seed_auth_users.sql > /dev/null

log_success "Test auth users setup complete"

# ==============================================
# Step 4: Start functions server
# ==============================================
log_info "Step 4: Starting functions server..."

# Kill any existing functions server
pkill -f "supabase.*functions.*serve" 2>/dev/null || true
sleep 2

# Start functions server in background
supabase functions serve --no-verify-jwt > /tmp/supabase-functions.log 2>&1 &
echo $! > "$FUNCTIONS_PID_FILE"

# Wait for functions to be ready
log_info "Waiting for functions server to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl -s http://localhost:54321/functions/v1/api-tickets/warmup > /dev/null 2>&1; then
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  log_error "Functions server failed to start. Check /tmp/supabase-functions.log"
  cat /tmp/supabase-functions.log
  exit 1
fi

log_success "Functions server is ready"

# ==============================================
# Step 5: Run E2E tests
# ==============================================
log_info "Step 5: Running E2E tests..."

# Build test command
TEST_CMD="deno test --allow-all --unstable-temporal"

if [ -n "$TEST_PATTERN" ]; then
  TEST_CMD="$TEST_CMD tests/e2e/*${TEST_PATTERN}*.test.ts"
else
  TEST_CMD="$TEST_CMD tests/e2e/"
fi

echo ""
echo "=============================================="
echo "Running: $TEST_CMD"
echo "=============================================="
echo ""

# Record start time
START_TIME=$(date +%s)

# Run tests and capture output
set +e  # Don't exit on test failure
$TEST_CMD 2>&1 | tee "$TEST_OUTPUT_FILE"
EXIT_CODE=${PIPESTATUS[0]}
set -e

# Record end time
END_TIME=$(date +%s)

if [ $EXIT_CODE -eq 0 ]; then
  log_success "All E2E tests passed!"
else
  log_error "Some E2E tests failed"
fi

# ==============================================
# Step 6: Generate HTML Report
# ==============================================
log_info "Step 6: Generating HTML report..."

# Use the new TypeScript report generator for detailed reports
if command -v deno &> /dev/null; then
  deno run --allow-all scripts/generate-e2e-report.ts "$TEST_OUTPUT_FILE" "$REPORT_FILE" 2>/dev/null
  if [ $? -eq 0 ]; then
    log_success "Detailed HTML report generated: $REPORT_FILE"
  else
    log_warn "TypeScript generator failed, falling back to basic report"
    generate_html_report "$TEST_OUTPUT_FILE" "$EXIT_CODE" "$START_TIME" "$END_TIME"
  fi
else
  generate_html_report "$TEST_OUTPUT_FILE" "$EXIT_CODE" "$START_TIME" "$END_TIME"
fi

echo ""
echo "=============================================="
echo "Report: $REPORT_FILE"
echo "=============================================="
echo ""

# Open report in browser (macOS)
if command -v open &> /dev/null; then
  open "$REPORT_FILE" 2>/dev/null || true
fi

# ==============================================
# Step 7: Cleanup (handled by trap)
# ==============================================
log_info "Step 7: Cleanup..."

exit $EXIT_CODE
