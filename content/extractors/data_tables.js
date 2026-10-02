/**
 * Data Tables Extractor
 * Extracts context from /data-tables (Data Tables / Reference Lists management)
 */
window.SecOpsDataTablesExtractor = {
  matches(url) {
    return url.includes("/data-tables") && !url.includes("/settings/");
  },

  extract() {
    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    // 1. Extract active Data Table name if viewing/editing a specific table
    let tableName = null;
    const nameEl = document.querySelector(
      "h1, h2, .table-title, [data-testid='table-name'], input[placeholder*='Table name']"
    );
    if (nameEl && nameEl.textContent) {
      const text = (nameEl.value || nameEl.textContent).trim();
      if (text && !text.toLowerCase().includes("data table")) {
        tableName = text;
      }
    }

    // 2. Extract column headers / schema
    const columns = [];
    document.querySelectorAll("table thead th, .column-header, [role='columnheader']").forEach((th) => {
      const colText = th.innerText.replace(/\s+/g, " ").trim();
      if (colText && colText.length < 50 && !columns.includes(colText)) {
        columns.push(colText);
      }
    });

    // 3. Extract visible rows
    const visibleRows = [];
    document.querySelectorAll("table tbody tr, [role='row']").forEach((row) => {
      const text = row.innerText.replace(/\s+/g, " ").trim();
      if (text && text.length > 5 && visibleRows.length < 10) {
        visibleRows.push(window.SecOpsDOMUtils.truncate(text, 160));
      }
    });

    const mainEl = document.querySelector("main, [role='main'], #main-content, .data-tables-container");
    const summary = mainEl ? window.SecOpsDOMUtils.truncate(mainEl.innerText.replace(/\s+/g, " ").trim(), 1500) : null;

    return {
      feature: tableName ? `Data Table • ${tableName}` : "Data Tables",
      route: "data-tables",
      tableName: tableName,
      columnsCount: columns.length,
      columns: columns.length > 0 ? columns : null,
      rowsCount: visibleRows.length,
      visibleRows: visibleRows.length > 0 ? visibleRows : null,
      detectedErrors: errors.length > 0 ? errors : null,
      summary: summary
    };
  }
};
