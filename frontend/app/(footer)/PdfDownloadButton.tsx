"use client";

type StaticPage = {
  slug: string;
  title: string;
  content: string;
  summary: string;
  date: string;
};

type Props = {
  page: StaticPage;
};

const normalizeAscii = (value: string) =>
  String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16) || 32))
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .trim();

const pdfEscape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const htmlToText = (html: string) => {
  const text = String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|h1|h2|h3|h4|h5|h6|li|tr|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<tr[^>]*>/gi, "\n")
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, "");

  return normalizeAscii(text)
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const wrapText = (value: string, maxChars = 90) => {
  const lines: string[] = [];
  const paragraphs = String(value || "").split(/\n+/);

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = "";

    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }

      if ((current + " " + word).length <= maxChars) {
        current += " " + word;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines.length ? lines : [""];
};

const paginate = (lines: string[], firstPageLimit = 38, nextPageLimit = 46) => {
  const pages: string[][] = [];
  if (lines.length <= firstPageLimit) {
    return [lines];
  }

  pages.push(lines.slice(0, firstPageLimit));
  let index = firstPageLimit;
  while (index < lines.length) {
    pages.push(lines.slice(index, index + nextPageLimit));
    index += nextPageLimit;
  }

  return pages;
};

const drawLine = (text: string, font: "F1" | "F2", size: number, x: number, y: number) =>
  `BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET\n`;

const buildPdf = (record: StaticPage) => {
  const title = normalizeAscii(record.title || "Static Page");
  const date = normalizeAscii(record.date || "");
  const summary = htmlToText(record.summary || "");
  const body = htmlToText(record.content || "");

  const summaryLines = summary ? wrapText(summary, 86) : [];
  const bodyLines = wrapText(body, 92);
  const pages = paginate(bodyLines);

  const contentStrings = pages.map((pageLines, pageIndex) => {
    let y = 742;
    let content = "0 g\n";

    if (pageIndex === 0) {
      content += drawLine(title, "F2", 18, 50, y);
      y -= 26;

      if (date) {
        content += drawLine(`Published: ${date}`, "F1", 10, 50, y);
        y -= 18;
      }

      if (summaryLines.length) {
        for (const line of summaryLines) {
          content += drawLine(line, "F1", 11, 50, y);
          y -= 15;
        }
        y -= 8;
      }
    }

    for (const line of pageLines) {
      content += drawLine(line || " ", "F1", 11, 50, y);
      y -= 15;
    }

    return content;
  });

  const totalObjects = 4 + pages.length * 2;
  const contentObjectNumbers = pages.map((_, index) => 5 + index * 2);
  const pageObjectNumbers = pages.map((_, index) => 6 + index * 2);
  const objects = new Map<number, string>();

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((_, index) => {
    const contentNumber = contentObjectNumbers[index];
    const pageNumber = pageObjectNumbers[index];
    const content = contentStrings[index];
    const contentLength = content.length;

    objects.set(contentNumber, `<< /Length ${contentLength} >>\nstream\n${content}endstream`);
    objects.set(
      pageNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`
    );
  });

  const parts: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];

  for (let i = 1; i <= totalObjects; i += 1) {
    const objectBody = objects.get(i);
    if (!objectBody) {
      throw new Error(`Missing PDF object ${i}`);
    }
    offsets[i] = parts.join("").length;
    parts.push(`${i} 0 obj\n${objectBody}\nendobj\n`);
  }

  const xrefOffset = parts.join("").length;
  const xrefLines = [`xref`, `0 ${totalObjects + 1}`, `0000000000 65535 f `];

  for (let i = 1; i <= totalObjects; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    `trailer`,
    `<< /Size ${totalObjects + 1} /Root 1 0 R >>`,
    `startxref`,
    `${xrefOffset}`,
    `%%EOF`,
  ].join("\n");

  return `${parts.join("")}${xrefLines.join("\n")}\n${trailer}`;
};

export default function PdfDownloadButton({ page }: Props) {
  const handleDownload = () => {
    const pdf = buildPdf(page);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const fileName = `${(page.slug || "page")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "page"}.pdf`;

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <button type="button" className="static-download-btn" onClick={handleDownload}>
      Download Page
    </button>
  );
}
