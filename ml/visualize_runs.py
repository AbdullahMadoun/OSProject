#!/usr/bin/env python3
"""Generate a self-contained HTML dashboard from scheduler CSV exports."""

from __future__ import annotations

import argparse
import csv
import html
import os
from collections import defaultdict
from typing import Iterable


NUMERIC_FIELDS = {
    "algo_id": int,
    "n_procs": int,
    "max_priority": int,
    "quantum": int,
    "ctx_overhead": int,
    "context_switches": int,
    "avg_burst": float,
    "std_burst": float,
    "avg_arrival_gap": float,
    "avg_waiting": float,
    "avg_turnaround": float,
    "avg_response": float,
    "cpu_utilization": float,
    "throughput": float,
}

ALGO_ORDER = ["fcfs", "sjf", "rr", "priority"]
ALGO_COLORS = {
    "fcfs": "#0b6e4f",
    "sjf": "#d97706",
    "rr": "#2563eb",
    "priority": "#b91c1c",
}
METRIC_LABELS = {
    "avg_waiting": "Average Waiting Time",
    "avg_turnaround": "Average Turnaround Time",
    "avg_response": "Average Response Time",
    "context_switches": "Context Switches",
}


def load_rows(path: str) -> list[dict[str, object]]:
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for raw in reader:
            row: dict[str, object] = dict(raw)
            for field, caster in NUMERIC_FIELDS.items():
                if raw.get(field, "") == "":
                    continue
                row[field] = caster(raw[field])
            rows.append(row)
    return rows


def _algo_sort_key(algo: str) -> tuple[int, str]:
    try:
        return (ALGO_ORDER.index(algo), algo)
    except ValueError:
        return (len(ALGO_ORDER), algo)


def summarize_by_algo(rows: Iterable[dict[str, object]]) -> list[dict[str, object]]:
    grouped: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    counts: dict[str, int] = defaultdict(int)

    for row in rows:
        algo = str(row["algo"])
        counts[algo] += 1
        grouped[algo]["avg_waiting"] += float(row["avg_waiting"])
        grouped[algo]["avg_turnaround"] += float(row["avg_turnaround"])
        grouped[algo]["avg_response"] += float(row["avg_response"])
        grouped[algo]["cpu_utilization"] += float(row["cpu_utilization"])
        grouped[algo]["throughput"] += float(row["throughput"])
        grouped[algo]["context_switches"] += float(row["context_switches"])

    summary = []
    for algo, totals in grouped.items():
        count = counts[algo]
        summary.append(
            {
                "algo": algo,
                "runs": count,
                "avg_waiting": totals["avg_waiting"] / count,
                "avg_turnaround": totals["avg_turnaround"] / count,
                "avg_response": totals["avg_response"] / count,
                "cpu_utilization": totals["cpu_utilization"] / count,
                "throughput": totals["throughput"] / count,
                "context_switches": totals["context_switches"] / count,
            }
        )

    summary.sort(key=lambda row: _algo_sort_key(str(row["algo"])))
    return summary


def latest_per_algo(rows: Iterable[dict[str, object]]) -> list[dict[str, object]]:
    latest: dict[str, dict[str, object]] = {}
    for row in rows:
        latest[str(row["algo"])] = dict(row)

    ordered = list(latest.values())
    ordered.sort(key=lambda row: _algo_sort_key(str(row["algo"])))
    return ordered


def _format_metric(value: object, metric: str) -> str:
    if metric == "context_switches":
        return f"{float(value):.0f}"
    return f"{float(value):.2f}"


def _metric_winner(rows: list[dict[str, object]], metric: str, lower_is_better: bool) -> float:
    values = [float(row[metric]) for row in rows]
    return min(values) if lower_is_better else max(values)


def _bar_width(value: float, values: list[float], lower_is_better: bool) -> float:
    low = min(values)
    high = max(values)

    if abs(high - low) < 1e-9:
        return 100.0

    if lower_is_better:
        score = (high - value) / (high - low)
    else:
        score = (value - low) / (high - low)

    return 18.0 + score * 82.0


def _bar_chart(rows: list[dict[str, object]], metric: str, lower_is_better: bool) -> str:
    if not rows:
        return "<p>No data available.</p>"

    best_value = _metric_winner(rows, metric, lower_is_better)
    values = [float(row[metric]) for row in rows]
    bars = []

    for row in rows:
        algo = str(row["algo"])
        value = float(row[metric])
        width = _bar_width(value, values, lower_is_better)
        color = ALGO_COLORS.get(algo, "#475569")
        winner_class = " winner" if abs(value - best_value) < 1e-9 else ""
        bars.append(
            f"""
            <div class="bar-row{winner_class}">
              <div class="bar-label">{html.escape(algo.upper())}</div>
              <div class="bar-track">
                <div class="bar-fill" style="width:{width:.2f}%;background:{color};"></div>
              </div>
              <div class="bar-value">{_format_metric(value, metric)}</div>
            </div>
            """
        )

    note = "Lower is better" if lower_is_better else "Higher is better"
    return (
        f'<section class="chart-card">'
        f'<h3>{html.escape(METRIC_LABELS[metric])}</h3>'
        f'<p class="chart-note">{note}</p>'
        f'{"".join(bars)}'
        f"</section>"
    )


def _summary_table(rows: list[dict[str, object]], title: str) -> str:
    if not rows:
        return "<p>No rows found.</p>"

    header = (
        "<tr><th>Algorithm</th><th>Runs</th><th>Wait</th><th>Turnaround</th>"
        "<th>Response</th><th>CPU Util.</th><th>Throughput</th><th>Ctx</th></tr>"
    )
    body = []
    for row in rows:
        runs = row.get("runs", 1)
        body.append(
            "<tr>"
            f"<td>{html.escape(str(row['algo']).upper())}</td>"
            f"<td>{int(runs)}</td>"
            f"<td>{float(row['avg_waiting']):.2f}</td>"
            f"<td>{float(row['avg_turnaround']):.2f}</td>"
            f"<td>{float(row['avg_response']):.2f}</td>"
            f"<td>{float(row['cpu_utilization']):.2f}</td>"
            f"<td>{float(row['throughput']):.2f}</td>"
            f"<td>{float(row['context_switches']):.0f}</td>"
            "</tr>"
        )
    return (
        f'<section class="table-card"><h3>{html.escape(title)}</h3>'
        f'<div class="table-wrap"><table>{header}{"".join(body)}</table></div></section>'
    )


def build_html_report(rows: list[dict[str, object]], source_name: str) -> str:
    if not rows:
        raise ValueError("No data rows found in CSV input.")

    summary_rows = summarize_by_algo(rows)
    latest_rows = latest_per_algo(rows)
    total_runs = len(rows)
    chart_html = "".join(
        [
            _bar_chart(summary_rows, "avg_waiting", True),
            _bar_chart(summary_rows, "avg_turnaround", True),
            _bar_chart(summary_rows, "avg_response", True),
            _bar_chart(summary_rows, "context_switches", True),
        ]
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CPU Scheduler Dashboard</title>
  <style>
    :root {{
      --bg: #f4efe6;
      --paper: #fffdf8;
      --ink: #172033;
      --muted: #5d6b82;
      --line: #d8cfbf;
      --accent: #172033;
      --winner: #ecfccb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, #f8e7b5 0, transparent 28%),
        radial-gradient(circle at right 20%, #d6e8ff 0, transparent 22%),
        linear-gradient(180deg, #f7f2ea 0%, var(--bg) 100%);
    }}
    .page {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }}
    .hero {{
      background: linear-gradient(135deg, rgba(255,253,248,0.95), rgba(250,244,232,0.88));
      border: 1px solid rgba(23,32,51,0.08);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 50px rgba(23,32,51,0.08);
    }}
    .eyebrow {{
      margin: 0 0 10px;
      color: #8a5a10;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }}
    h1, h2, h3 {{
      margin: 0;
      font-weight: 700;
    }}
    h1 {{
      font-size: clamp(2rem, 5vw, 4rem);
      line-height: 0.95;
      max-width: 10ch;
    }}
    .hero p {{
      max-width: 64ch;
      color: var(--muted);
      font-size: 1.05rem;
    }}
    .stats {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-top: 24px;
    }}
    .stat {{
      padding: 16px;
      background: rgba(255,255,255,0.65);
      border: 1px solid rgba(23,32,51,0.08);
      border-radius: 16px;
    }}
    .stat-label {{
      display: block;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 6px;
    }}
    .stat-value {{
      font-size: clamp(1.15rem, 2.2vw, 1.8rem);
      font-weight: 700;
      overflow-wrap: anywhere;
      word-break: break-word;
    }}
    .chart-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      align-items: start;
      gap: 18px;
      margin-top: 22px;
    }}
    .table-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
      align-items: start;
      gap: 18px;
      margin-top: 22px;
    }}
    .chart-card, .table-card {{
      background: var(--paper);
      border: 1px solid rgba(23,32,51,0.08);
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 10px 28px rgba(23,32,51,0.05);
      min-width: 0;
    }}
    .chart-note {{
      color: var(--muted);
      margin: 8px 0 16px;
    }}
    .bar-row {{
      display: grid;
      grid-template-columns: 122px 1fr 72px;
      gap: 10px;
      align-items: center;
      margin: 12px 0;
      padding: 8px 10px;
      border-radius: 14px;
    }}
    .bar-row.winner {{
      background: var(--winner);
    }}
    .bar-label, .bar-value {{
      font-weight: 700;
      font-size: 0.95rem;
    }}
    .bar-label {{
      min-width: 0;
      white-space: nowrap;
    }}
    .bar-track {{
      height: 14px;
      background: #ebe4d9;
      border-radius: 999px;
      overflow: hidden;
      min-width: 0;
    }}
    .bar-fill {{
      height: 100%;
      border-radius: 999px;
    }}
    .table-wrap {{
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      margin-top: 14px;
      padding-bottom: 4px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
      min-width: 720px;
    }}
    th, td {{
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
    }}
    th {{
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }}
    @media (max-width: 1080px) {{
      .table-grid {{
        grid-template-columns: 1fr;
      }}
    }}
    @media (max-width: 680px) {{
      .bar-row {{
        grid-template-columns: 92px 1fr 58px;
      }}
      .page {{
        padding: 20px 14px 36px;
      }}
      .chart-grid {{
        grid-template-columns: 1fr;
      }}
      .table-grid {{
        grid-template-columns: 1fr;
      }}
      .chart-card, .table-card {{
        padding: 16px;
      }}
    }}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <p class="eyebrow">Scheduler Visualization</p>
      <h1>CPU Scheduling Results Dashboard</h1>
      <p>
        This report summarizes scheduler output exported to CSV by the C simulator.
        Use it to compare algorithm behavior without relying only on terminal output.
      </p>
      <div class="stats">
        <div class="stat"><span class="stat-label">Source</span><span class="stat-value">{html.escape(source_name)}</span></div>
        <div class="stat"><span class="stat-label">Rows</span><span class="stat-value">{total_runs}</span></div>
        <div class="stat"><span class="stat-label">Algorithms</span><span class="stat-value">{len(summary_rows)}</span></div>
      </div>
    </section>
    <section class="chart-grid">
      {chart_html}
    </section>
    <section class="table-grid">
      {_summary_table(summary_rows, "Average Metrics By Algorithm")}
      {_summary_table(latest_rows, "Latest Row Per Algorithm")}
    </section>
  </main>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build an HTML dashboard from scheduler CSV exports."
    )
    parser.add_argument("csv_path", help="Path to a scheduler export CSV file.")
    parser.add_argument(
        "-o",
        "--output",
        help="Output HTML path. Defaults to <csv_path>.html",
    )
    args = parser.parse_args()

    output_path = args.output or f"{args.csv_path}.html"
    rows = load_rows(args.csv_path)
    report = build_html_report(rows, os.path.basename(args.csv_path))
    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(report)

    print(f"Dashboard written to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
