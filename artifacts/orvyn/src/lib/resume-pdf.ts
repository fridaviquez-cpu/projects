import { jsPDF } from 'jspdf';

/** Plain, single-column, ATS-friendly PDF from resume text. */
export async function createResumePdf(content: string) {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;
  const lines = content.replace(/\r/g, '').split('\n');
  lines.forEach((line, i) => {
    const heading = /^[A-Z][A-Z &/]{2,}$/.test(line.trim());
    const first = i === 0 && line.trim();
    pdf.setFont('helvetica', heading || first ? 'bold' : 'normal');
    pdf.setFontSize(first ? 15 : heading ? 11 : 10.5);
    if (heading && y > margin) y += 6;
    const wrapped: string[] = line.trim() ? pdf.splitTextToSize(line, width) : [''];
    for (const w of wrapped) {
      if (y > bottom) { pdf.addPage(); y = margin; }
      pdf.text(w, margin, y);
      y += first ? 20 : 14;
    }
  });
  return pdf;
}
