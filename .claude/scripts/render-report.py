#!/usr/bin/env python3
"""
Render a JSON audit/review findings file into a single self-contained HTML report.

Usage:
    python3 render-report.py findings.json [output.html]

If output.html omitted, writes report-<timestamp>.html next to findings.json
and prints the absolute path of the written file on stdout.

All HTML for findings is rendered Python-side (server-side rendered) to keep
the JS layer trivial — it only toggles a .hidden class on pre-rendered nodes
based on severity/category/search filters. No innerHTML or eval.

Input JSON schema (minimum):
{
  "title":        "Service review: EducationContentService",
  "scope":        "backend/EducationContentService",
  "generatedAt":  "2026-05-19T11:00:00Z",
  "findings": [
    {
      "id":         "F-001",
      "severity":   "high",        # blocker | high | medium | low | info
      "category":   "performance", # free-form, used for filter chips
      "title":      "N+1 query in GetCourseList",
      "file":       "backend/.../GetCourseList.cs",
      "line":       42,            # int, optional
      "summary":    "Each course loads modules separately.",
      "snippet":    "var modules = await ...",    # optional
      "recommendation": "Use Include(c => c.Modules).",
      "before":     "O(n*m) queries",             # optional chip
      "after":      "O(1) query",                 # optional chip
      "risk":       "low"                          # optional chip
    }
  ]
}

Extra top-level fields are accepted and ignored.
"""

import json
import sys
import html
import datetime
from pathlib import Path

SEVERITY_ORDER = {"blocker": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
SEVERITY_COLORS = {
    "blocker": "#ff3b30",
    "high":    "#ff6b35",
    "medium":  "#f5a623",
    "low":     "#5ac8fa",
    "info":    "#8e8e93",
}


def esc(s):
    return html.escape(str(s)) if s is not None else ""


def render_finding(f: dict) -> str:
    sev = f.get("severity", "info")
    color = SEVERITY_COLORS.get(sev, "#888")
    cat = f.get("category", "other")

    parts = [
        f'<div class="finding" data-sev="{esc(sev)}" data-cat="{esc(cat)}" style="--sev-color: {color}">',
        '<div class="finding-head">',
        f'<span class="finding-sev">{esc(sev)}</span>',
        f'<span class="finding-title">{esc(f.get("title", ""))}</span>',
        f'<span class="finding-cat">{esc(cat)}</span>',
        '</div>',
    ]
    if f.get("file"):
        loc = esc(f["file"]) + (f":{f['line']}" if f.get("line") else "")
        parts.append(f'<div class="finding-loc">{loc}</div>')
    if f.get("summary"):
        parts.append(f'<div class="finding-summary">{esc(f["summary"])}</div>')
    if f.get("snippet"):
        parts.append(f'<pre class="finding-snippet">{esc(f["snippet"])}</pre>')
    if f.get("recommendation"):
        parts.append(f'<div class="finding-rec">{esc(f["recommendation"])}</div>')

    meta_chips = []
    if f.get("before"):
        meta_chips.append(f'<span>before: {esc(f["before"])}</span>')
    if f.get("after"):
        meta_chips.append(f'<span>after: {esc(f["after"])}</span>')
    if f.get("risk"):
        meta_chips.append(f'<span>risk: {esc(f["risk"])}</span>')
    if f.get("id"):
        meta_chips.append(f'<span>id: {esc(f["id"])}</span>')
    if meta_chips:
        parts.append(f'<div class="finding-meta">{"".join(meta_chips)}</div>')

    # hidden searchable blob for client-side text search
    searchable = " ".join(
        esc(f.get(k, "")) for k in ("title", "file", "summary", "snippet", "recommendation", "category")
    ).lower()
    parts.append(f'<span class="search-blob" hidden>{searchable}</span>')
    parts.append('</div>')
    return "".join(parts)


def render(data: dict) -> str:
    title = data.get("title", "Audit report")
    scope = data.get("scope", "")
    generated = data.get("generatedAt") or datetime.datetime.now().isoformat(timespec="seconds")
    findings = data.get("findings", [])

    findings = sorted(
        findings,
        key=lambda f: (
            SEVERITY_ORDER.get(f.get("severity", "info"), 99),
            f.get("file", ""),
            f.get("line", 0),
        ),
    )

    counts = {}
    for f in findings:
        s = f.get("severity", "info")
        counts[s] = counts.get(s, 0) + 1

    categories = sorted({f.get("category", "other") for f in findings})

    summary_chips = "".join(
        f'<span class="sev-chip" style="background:{SEVERITY_COLORS.get(s, "#888")}">'
        f'{esc(s)}: {counts[s]}</span>'
        for s in sorted(counts, key=lambda x: SEVERITY_ORDER.get(x, 99))
    )

    sev_filters = "".join(
        f'<label class="filter-chip"><input type="checkbox" class="sev-filter" value="{esc(s)}" checked>'
        f'<span class="sev-dot" style="background:{SEVERITY_COLORS.get(s, "#888")}"></span>{esc(s)} ({counts[s]})</label>'
        for s in sorted(counts, key=lambda x: SEVERITY_ORDER.get(x, 99))
    )

    cat_filters = "".join(
        f'<label class="filter-chip"><input type="checkbox" class="cat-filter" value="{esc(c)}" checked>{esc(c)}</label>'
        for c in categories
    )

    findings_html = "".join(render_finding(f) for f in findings) if findings else \
        '<div class="empty">No findings.</div>'

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<style>
  :root {{
    --bg: #0d1117; --panel: #161b22; --border: #30363d;
    --fg: #e6edf3; --muted: #8b949e; --link: #58a6ff; --code-bg: #1f2428;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 24px;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    background: var(--bg); color: var(--fg);
  }}
  header {{ margin-bottom: 24px; }}
  h1 {{ margin: 0 0 4px; font-size: 22px; font-weight: 600; }}
  .meta {{ color: var(--muted); font-size: 13px; }}
  .meta code {{ background: var(--code-bg); padding: 1px 6px; border-radius: 3px; }}
  .summary {{ margin: 16px 0; display: flex; gap: 8px; flex-wrap: wrap; }}
  .sev-chip {{
    color: white; padding: 4px 10px; border-radius: 4px;
    font-weight: 600; font-size: 12px; text-transform: uppercase;
  }}
  .filters {{
    background: var(--panel); border: 1px solid var(--border);
    padding: 12px; border-radius: 6px; margin-bottom: 16px;
    display: flex; gap: 16px; flex-wrap: wrap; align-items: center;
  }}
  .filters > div {{ display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }}
  .filter-chip {{
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; background: var(--code-bg);
    border: 1px solid var(--border); border-radius: 4px;
    font-size: 12px; cursor: pointer; user-select: none;
  }}
  .filter-chip input {{ margin: 0; cursor: pointer; }}
  .sev-dot {{ width: 8px; height: 8px; border-radius: 50%; display: inline-block; }}
  #search {{
    background: var(--code-bg); border: 1px solid var(--border);
    color: var(--fg); padding: 6px 10px; border-radius: 4px;
    font-size: 13px; width: 280px;
  }}
  .findings {{ display: flex; flex-direction: column; gap: 10px; }}
  .finding {{
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 6px; padding: 14px 16px;
    border-left: 4px solid var(--sev-color, #888);
  }}
  .finding.hidden {{ display: none; }}
  .finding-head {{ display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }}
  .finding-sev {{
    text-transform: uppercase; font-size: 11px; font-weight: 700;
    padding: 2px 7px; border-radius: 3px; color: white;
    background: var(--sev-color, #888); flex-shrink: 0;
  }}
  .finding-title {{ font-size: 15px; font-weight: 600; flex: 1; min-width: 0; }}
  .finding-cat {{
    font-size: 11px; color: var(--muted); background: var(--code-bg);
    padding: 2px 7px; border-radius: 3px;
  }}
  .finding-loc {{
    font-family: ui-monospace, SF Mono, Menlo, monospace;
    font-size: 12px; color: var(--link); margin-top: 4px;
  }}
  .finding-summary {{ margin: 8px 0; color: var(--fg); }}
  .finding-snippet {{
    background: var(--code-bg); border: 1px solid var(--border);
    padding: 8px 10px; border-radius: 4px; margin: 8px 0;
    font-family: ui-monospace, SF Mono, Menlo, monospace;
    font-size: 12px; white-space: pre-wrap; word-break: break-word;
    overflow-x: auto;
  }}
  .finding-rec {{
    border-left: 3px solid var(--link); padding-left: 10px;
    margin: 8px 0; color: var(--fg);
  }}
  .finding-rec::before {{
    content: "Fix:"; display: inline-block; font-weight: 600;
    color: var(--link); margin-right: 6px;
  }}
  .finding-meta {{ display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }}
  .finding-meta span {{
    font-size: 11px; padding: 2px 7px; border-radius: 3px;
    background: var(--code-bg); color: var(--muted);
  }}
  .empty {{ text-align: center; color: var(--muted); padding: 40px; }}
</style>
</head>
<body>
<header>
  <h1>{esc(title)}</h1>
  <div class="meta">
    Scope: <code>{esc(scope)}</code> · Generated: {esc(generated)} · Total findings: {len(findings)}
  </div>
  <div class="summary">{summary_chips}</div>
</header>

<div class="filters">
  <div><strong>Severity:</strong>{sev_filters}</div>
  <div><strong>Category:</strong>{cat_filters}</div>
  <div><input id="search" type="search" placeholder="Search title/file/text..."></div>
  <div><span id="count" style="color: var(--muted); font-size: 13px;"></span></div>
</div>

<div class="findings" id="findings">{findings_html}</div>

<script>
// Pure visibility-toggle filter. No HTML construction in JS — every node is
// already in the DOM, server-rendered. We only add/remove the .hidden class.
(function () {{
  const total = document.querySelectorAll(".finding").length;
  const countEl = document.getElementById("count");

  function apply() {{
    const allowedSev = new Set(
      Array.from(document.querySelectorAll(".sev-filter:checked")).map(x => x.value)
    );
    const allowedCat = new Set(
      Array.from(document.querySelectorAll(".cat-filter:checked")).map(x => x.value)
    );
    const q = document.getElementById("search").value.toLowerCase().trim();
    let shown = 0;
    document.querySelectorAll(".finding").forEach(el => {{
      const sev = el.getAttribute("data-sev");
      const cat = el.getAttribute("data-cat");
      const blob = el.querySelector(".search-blob");
      const text = blob ? blob.textContent : "";
      const ok = allowedSev.has(sev) && allowedCat.has(cat) && (!q || text.includes(q));
      el.classList.toggle("hidden", !ok);
      if (ok) shown++;
    }});
    countEl.textContent = "Showing " + shown + " of " + total;
  }}

  document.querySelectorAll(".sev-filter, .cat-filter").forEach(el =>
    el.addEventListener("change", apply)
  );
  document.getElementById("search").addEventListener("input", apply);
  apply();
}})();
</script>
</body>
</html>
"""


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if sys.argv[1:] and sys.argv[1] in ("-h", "--help") else 2)

    in_path = Path(sys.argv[1])
    if not in_path.exists():
        print(f"error: {in_path} not found", file=sys.stderr)
        sys.exit(1)

    data = json.loads(in_path.read_text())

    if len(sys.argv) >= 3:
        out_path = Path(sys.argv[2])
    else:
        stamp = datetime.datetime.now().strftime("%Y-%m-%d-%H%M%S")
        out_path = in_path.parent / f"report-{stamp}.html"

    out_path.write_text(render(data))
    print(out_path.resolve())


if __name__ == "__main__":
    main()
