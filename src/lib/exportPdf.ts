import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface GiveawayParticipant {
  number: number;
  name: string;
  username: string;
  loftName: string;
  plan: string;
  status: string;
  expires: string;
}

export interface ExportPdfOptions {
  title: string;
  filterLabel: string;
  totalLabel: string;
  generatedAtLabel: string;
  participants: GiveawayParticipant[];
  fileName?: string;
  headers: {
    number: string;
    name: string;
    username: string;
    loft: string;
    plan: string;
    status: string;
    expires: string;
  };
}

export function exportGiveawayPdf({
  title,
  filterLabel,
  totalLabel,
  generatedAtLabel,
  participants,
  fileName,
  headers,
}: ExportPdfOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [183, 28, 28]; // #B71C1C (Palomero primary red)
  const darkTextColor: [number, number, number] = [31, 41, 55]; // #1F2937
  const mutedTextColor: [number, number, number] = [107, 114, 128]; // #6B7280

  // 1. Header background bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 20, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 13);

  // 2. Metadata Section
  doc.setTextColor(...darkTextColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${filterLabel}`, 14, 28);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedTextColor);
  const nowStr = new Date().toLocaleString();
  doc.text(`${generatedAtLabel}: ${nowStr}`, 14, 34);
  doc.text(`${totalLabel}: ${participants.length}`, 140, 34);

  // 3. Table Rows
  const tableData = participants.map((p) => [
    p.number.toString(),
    p.name,
    `@${p.username}`,
    p.loftName || '—',
    p.plan,
    p.status,
    p.expires,
  ]);

  autoTable(doc, {
    startY: 38,
    head: [
      [
        headers.number,
        headers.name,
        headers.username,
        headers.loft,
        headers.plan,
        headers.status,
        headers.expires,
      ],
    ],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    styles: {
      fontSize: 8.5,
      textColor: darkTextColor,
      cellPadding: 2.2,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' }, // #
      1: { cellWidth: 42, fontStyle: 'bold' }, // Name
      2: { cellWidth: 35 }, // Username
      3: { cellWidth: 35 }, // Loft
      4: { cellWidth: 20 }, // Plan
      5: { cellWidth: 25 }, // Status
      6: { cellWidth: 23 }, // Expires
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // subtle gray #F9FAFB
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageNumber = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(...mutedTextColor);
      doc.text(
        `Página ${data.pageNumber} de ${pageNumber}`,
        14,
        290,
      );
      doc.text(
        'Palomero Plus — Sistema Oficial de Sorteos',
        140,
        290,
      );
    },
  });

  const finalName = fileName || `sorteos_pro_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(finalName);
}
