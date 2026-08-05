import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { TableColumn } from '@/types';

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
function extractCellValue<T>(
  value: any,
  row: T,
  column: TableColumn<T>
): string {
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
 * Export table data to CSV
 */
export function exportToCSV<T extends Record<string, any>>(
  columns: TableColumn<T>[],
  data: T[],
  filename: string = 'export'
): void {
  // Extract headers
  const headers = columns.map((col) => col.label);
  
  // Extract rows
  const rows = data.map((row) =>
    columns.map((column) => {
      const value = row[column.key];
      const textValue = extractCellValue(value, row, column);
      // Escape commas and quotes for CSV
      if (textValue.includes(',') || textValue.includes('"') || textValue.includes('\n')) {
        return `"${textValue.replace(/"/g, '""')}"`;
      }
      return textValue;
    })
  );
  
  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(','))
  ].join('\n');
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
 */
export function exportToPDF<T extends Record<string, any>>(
  columns: TableColumn<T>[],
  data: T[],
  filename: string = 'export',
  title?: string
): void {
  const doc = new jsPDF();
  
  // Add title if provided
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 15);
  }
  
  // Extract headers and rows
  const headers = columns.map((col) => col.label);
  const rows = data.map((row) =>
    columns.map((column) => {
      const value = row[column.key];
      return extractCellValue(value, row, column);
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

