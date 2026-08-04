const xlsx = require('xlsx');
const fs = require('fs');

try {
  const workbook = xlsx.readFile('c:/Projetos/cyber-itsm/BaseRequisitosSD_v4.1.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  // Take the first 50 rows or so to summarize, or dump everything into a text file
  const output = JSON.stringify(data, null, 2);
  fs.writeFileSync('c:/Projetos/cyber-itsm/requisitos.json', output);
  console.log("Successfully parsed " + data.length + " rows.");
} catch (e) {
  console.error("Error parsing xlsx:", e);
}
