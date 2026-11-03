// ── Report export helpers ────────────────────────────────────────────────────
// Three real, dependency-free export paths used across the reporting pages:
//   • CSV   — plain comma-separated text (opens in Excel, Sheets, Numbers)
//   • Excel — SpreadsheetML 2003 (.xls), which Excel opens natively with
//             multiple sheets and typed cells, with no library to install
//   • PDF   — a styled print view; the browser's "Save as PDF" produces the file
// Nothing here fabricates data: every row comes from the caller's own query.

import { toCsv, downloadCsv } from "@shared/format";

export type Cell = string | number | null | undefined;
export interface Sheet {
  name: string;
  headers: string[];
  rows: Cell[][];
}

/** CSV download. Thin wrapper so pages import one module for every format. */
export function exportCsv(filename: string, headers: string[], rows: Cell[][]): void {
  downloadCsv(filename, toCsv(headers, rows.map((r) => r.map((c) => c ?? ""))));
}

function xmlEscape(v: Cell): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sheetName(name: string): string {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  return (name.replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet").slice(0, 31);
}

/**
 * Excel workbook (.xls, SpreadsheetML 2003). Numbers are written as Number
 * cells so Excel treats them as values, not text — which is what makes the
 * exported figures summable.
 */
export function exportExcel(filename: string, sheets: Sheet[]): void {
  const worksheets = sheets
    .map((s) => {
      const headerRow = `<Row>${s.headers
        .map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
        .join("")}</Row>`;
      const bodyRows = s.rows
        .map(
          (r) =>
            `<Row>${r
              .map((c) => {
                const isNum = typeof c === "number" && Number.isFinite(c);
                return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${xmlEscape(c)}</Data></Cell>`;
              })
              .join("")}</Row>`,
        )
        .join("");
      return `<Worksheet ss:Name="${xmlEscape(sheetName(s.name))}"><Table>${headerRow}${bodyRows}</Table></Worksheet>`;
    })
    .join("");

  const xml =
    `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/></Style></Styles>` +
    worksheets +
    `</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface PdfSection {
  heading: string;
  lines?: string[];
  table?: { headers: string[]; rows: Cell[][] };
}

function esc(v: Cell): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * PDF via the browser's own print pipeline. Opens a styled, self-contained
 * document in a new window and triggers print — the user chooses "Save as PDF".
 * This is the honest dependency-free route: no PDF library is bundled, and the
 * output is a real PDF produced by the browser.
 */
export function exportPdf(title: string, subtitle: string, sections: PdfSection[]): void {
  const body = sections
    .map((s) => {
      const lines = (s.lines ?? []).map((l) => `<p class="line">${esc(l)}</p>`).join("");
      const table = s.table
        ? `<table><thead><tr>${s.table.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
          `<tbody>${s.table.rows
            .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`
        : "";
      return `<section><h2>${esc(s.heading)}</h2>${lines}${table}</section>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 32px; }
  header { border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 0; color: #1e3a8a; }
  .sub { color: #64748b; font-size: 12px; margin-top: 4px; }
  section { margin-bottom: 22px; page-break-inside: avoid; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .line { font-size: 12px; margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  td:last-child, th:last-child { text-align: right; }
  footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; color: #94a3b8; font-size: 10px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
<header><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></header>
${body}
<footer>Generated by Core Grid Africa · ${esc(new Date().toLocaleString("en-NG"))}</footer>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    // Pop-up blocked — fall back to a downloadable HTML file the user can open.
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
