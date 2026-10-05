import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { TableColumn } from '@/types';
import { PDF_FONT_FAMILY, registerPdfFont } from '@/utils/pdfFonts';

/**
 * Recursively extract text from React elements
 */
function extractTextFromReactElement(element: any): string {
  if (element === null || element === undefined) {
    return '';
  }

  // Handle primitive types
  if (typeof element === 'string' || typeof element === 'number') {
    return String(element);
  }

  // Handle boolean
  if (typeof element === 'boolean') {
    return '';
  }

  // Handle arrays
  if (Array.isArray(element)) {
    return element.map(extractTextFromReactElement).filter(Boolean).join(' ');
  }

  // Handle React elements
  if (typeof element === 'object') {
    // Check if it's a React element with props
    if (element.props) {
      const children = element.props.children;
      if (children !== undefined && children !== null) {
        return extractTextFromReactElement(children);
      }
    }

    // Check if it has a type property (React element)
    if (element.type) {
      // For certain element types, try to extract text differently
      if (element.type === 'span' || element.type === 'div' || element.type === 'p') {
        return extractTextFromReactElement(element.props?.children);
      }
    }
  }

  return '';
}

/**
 * Extract text value from a cell, handling render functions
 */
function extractCellValue<T>(value: any, row: T, column: TableColumn<T>): string {
  if (column.render) {
    try {
      const rendered = column.render(value, row, 0);

      // Handle primitive types directly
      if (typeof rendered === 'string' || typeof rendered === 'number') {
        return String(rendered);
      }

      // Handle React elements
      if (rendered && typeof rendered === 'object') {
        const extractedText = extractTextFromReactElement(rendered);
        if (extractedText.trim()) {
          return extractedText.trim();
        }
      }

      // Fallback: use the original value
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      }
    } catch (error) {
      console.warn('Error extracting cell value:', error);
    }

    // Final fallback
    return '-';
  }

  // Handle null, undefined, and other types
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * One CSV field, safe to open in a spreadsheet.
 *
 * - Quoting: commas, quotes and newlines wrap the field in quotes.
 * - Long digit strings (account numbers, Aadhaar, ...) and anything with a leading
 *   zero are written as ="digits". A bare 16-digit account number opens in Excel
 *   as 1.23457E+15 and "00123456" loses its zeros; the formula form keeps the text.
 * - Formula injection: a field that starts with = + - @ (or a control character)
 *   would run as a formula when opened, and these columns hold user-typed text.
 *   Such fields get a leading apostrophe. Plain numbers ("-500") and phone numbers
 *   ("+91 98765 43210") are left alone, and so is the "-" empty-cell placeholder.
 */
export function toCsvField(text: string): string {
  if (/^\d+$/.test(text) && (text.length >= 12 || (text.length > 1 && text.startsWith('0')))) {
    return `="${text}"`;
  }
  let value = text;
  const startsLikeFormula =
    /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-]?[\d\s().,-]*$/.test(value));
  if (startsLikeFormula) value = `'${value}`;
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export table data to CSV
 */
export function exportToCSV<T extends Record<string, any>>(
  columns: TableColumn<T>[],
  data: T[],
  filename: string = 'export'
): void {
  // Extract headers
  const headers = columns.map((col) => toCsvField(col.label));

  // Extract rows
  const rows = data.map((row) =>
    columns.map((column) => {
      const value = row[column.key];
      return toCsvField(extractCellValue(value, row, column));
    })
  );

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  // Excel opens a CSV with no byte-order mark as ANSI (Windows-1252), so the
  // UTF-8 bytes of "₹" (E2 82 B9) read as "â‚¹". The BOM tells it the file is
  // UTF-8; every other app that reads UTF-8 skips it.
  const blob = new Blob(['﻿', csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export table data to JSON
 */
export function exportToJSON<T extends Record<string, any>>(
  columns: TableColumn<T>[],
  data: T[],
  filename: string = 'export'
): void {
  // Transform data to include only column keys with extracted values
  const jsonData = data.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((column) => {
      const value = row[column.key];
      const textValue = extractCellValue(value, row, column);
      obj[column.label] = textValue;
    });
    return obj;
  });

  const jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export table data to PDF
 *
 * Async because the Unicode font is fetched on first use. Callers that don't
 * await it are fine - the file is saved when the promise settles - and the
 * promise never rejects over the font: it falls back to the built-in one.
 */
export async function exportToPDF<T extends Record<string, any>>(
  columns: TableColumn<T>[],
  data: T[],
  filename: string = 'export',
  title?: string
): Promise<void> {
  const doc = new jsPDF();

  // The built-in fonts have no ₹ glyph; Noto Sans does.
  const unicodeFont = await registerPdfFont(doc);
  const fontFamily = unicodeFont ? PDF_FONT_FAMILY : 'helvetica';
  // Only if the font could not be loaded: "Rs." is readable, "¹" is not.
  const printable = (text: string) => (unicodeFont ? text : text.replace(/₹/g, 'Rs. '));

  // Add title if provided
  if (title) {
    doc.setFontSize(16);
    doc.text(printable(title), 14, 15);
  }

  // Extract headers and rows
  const headers = columns.map((col) => printable(col.label));
  const rows = data.map((row) =>
    columns.map((column) => {
      const value = row[column.key];
      return printable(extractCellValue(value, row, column));
    })
  );

  // Calculate starting Y position
  const startY = title ? 25 : 15;

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    styles: {
      font: fontFamily,
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [79, 70, 229], // primary-600 color
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // gray-50
    },
    margin: { top: startY, left: 14, right: 14 },
  });

  // Save PDF
  doc.save(`${filename}.pdf`);
}
