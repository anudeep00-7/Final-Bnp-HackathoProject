/**
 * Helper utility to generate and download CSV files directly in browser
 * @param {string} filename - name of the file to save
 * @param {Array<string>} headers - column header labels
 * @param {Array<Array<any>>} rows - array of row values
 */
export function exportToCsv(filename, headers, rows) {
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCsv).join(",");
  const rowLines = rows.map((r) => r.map(escapeCsv).join(","));
  const csvContent = "data:text/csv;charset=utf-8," + [headerLine, ...rowLines].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
