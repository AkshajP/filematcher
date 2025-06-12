// lib/reference-loader.ts - Reference Import and Template Functions

import { FileReference, generateUniqueId } from './types';

export interface ReferenceImportResult {
  references: FileReference[];
  totalRows: number;
  fileName: string;
}

/**
 * Parses CSV file and extracts Doc Description, Date, and References columns using Papaparse
 */
async function parseCSVReferences(file: File): Promise<FileReference[]> {
  return new Promise((resolve, reject) => {
    import('papaparse').then((Papa) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';'],
        transformHeader: (header: string) => {
          return header.replace(/"/g, '').trim();
        },
        complete: (results) => {
          try {
            const data = results.data as Array<Record<string, unknown>>;
            
            if (data.length === 0) {
              resolve([]);
              return;
            }
            
            const headers = Object.keys(data[0] || {});
            
            const docDescHeader = headers.find(h => {
              const cleanHeader = h.toLowerCase().trim();
              return cleanHeader.includes('doc description') || 
                     cleanHeader.includes('description') ||
                     cleanHeader === 'doc';
            });
            
            const dateHeader = headers.find(h => {
              const cleanHeader = h.toLowerCase().trim();
              return cleanHeader.includes('date');
            });
            
            const referenceHeader = headers.find(h => {
              const cleanHeader = h.toLowerCase().trim();
              return cleanHeader.includes('reference') ||
                     cleanHeader === 'references';
            });
            
            if (!docDescHeader) {
              reject(new Error(`No "Doc Description" column found. Available: ${headers.join(', ')}`));
              return;
            }
            
            const references: FileReference[] = [];
            
            data.forEach((row) => {
              const description = row[docDescHeader];
              if (description && String(description).trim()) {
                const ref: FileReference = {
                  id: generateUniqueId(),
                  description: String(description).trim(),
                  date: dateHeader && row[dateHeader] ? String(row[dateHeader]).trim() : undefined,
                  reference: referenceHeader && row[referenceHeader] ? String(row[referenceHeader]).trim() : undefined,
                  isGenerated: false
                };
                references.push(ref);
              }
            });
            
            resolve(references);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    }).catch(reject);
  });
}

/**
 * Simple fallback CSV parser (in case Papaparse fails)
 */
async function parseCSVSimple(file: File): Promise<FileReference[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          resolve([]);
          return;
        }
        
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
        
        const docDescIndex = headers.findIndex(h => 
          h.toLowerCase().includes('doc description') || 
          h.toLowerCase().includes('description') ||
          h.toLowerCase() === 'doc'
        );
        
        const dateIndex = headers.findIndex(h => 
          h.toLowerCase().includes('date')
        );
        
        const referenceIndex = headers.findIndex(h => 
          h.toLowerCase().includes('reference') ||
          h.toLowerCase() === 'references'
        );
        
        if (docDescIndex === -1) {
          throw new Error(`No "Doc Description" column found. Available columns: ${headers.join(', ')}`);
        }
        
        const references: FileReference[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const columns = line.split(',').map(c => c.trim().replace(/"/g, ''));
          const description = columns[docDescIndex];
          
          if (description && description.trim()) {
            const ref: FileReference = {
              id: generateUniqueId(),
              description: description.trim(),
              date: dateIndex !== -1 && columns[dateIndex] ? columns[dateIndex].trim() : undefined,
              reference: referenceIndex !== -1 && columns[referenceIndex] ? columns[referenceIndex].trim() : undefined,
              isGenerated: false
            };
            references.push(ref);
          }
        }
        
        resolve(references);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read CSV file'));
    reader.readAsText(file);
  });
}

/**
 * Parses Excel file and extracts Doc Description, Date, and References columns
 */
async function parseExcelReferences(file: File): Promise<FileReference[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const XLSX = await import('xlsx');
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        if (jsonData.length === 0) {
          resolve([]);
          return;
        }
        
        const headers = jsonData[0] || [];
        
        const docDescIndex = headers.findIndex(h => 
          h && h.toString().toLowerCase().includes('doc description') || 
          h && h.toString().toLowerCase().includes('description') ||
          h && h.toString().toLowerCase() === 'doc'
        );
        
        const dateIndex = headers.findIndex(h => 
          h && h.toString().toLowerCase().includes('date')
        );
        
        const referenceIndex = headers.findIndex(h => 
          h && h.toString().toLowerCase().includes('reference') ||
          h && h.toString().toLowerCase() === 'references'
        );
        
        if (docDescIndex === -1) {
          reject(new Error('No "Doc Description" column found in Excel file. Available columns: ' + headers.join(', ')));
          return;
        }
        
        const references: FileReference[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] || [];
          const description = row[docDescIndex];
          
          if (description && description.toString().trim()) {
            references.push({
              id: generateUniqueId(),
              description: description.toString().trim(),
              date: dateIndex !== -1 && row[dateIndex] ? row[dateIndex].toString().trim() : undefined,
              reference: referenceIndex !== -1 && row[referenceIndex] ? row[referenceIndex].toString().trim() : undefined,
              isGenerated: false
            });
          }
        }
        
        resolve(references);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Main function to import references from a file
 */
export async function importReferencesFromFile(file: File): Promise<ReferenceImportResult> {
  const fileName = file.name;
  const fileExtension = fileName.toLowerCase().split('.').pop();
  
  let references: FileReference[] = [];
  
  try {
    if (fileExtension === 'csv') {
      try {
        references = await parseCSVReferences(file);
        
        // If Papaparse returns 0 results, try simple parser
        if (references.length === 0) {
          references = await parseCSVSimple(file);
        }
      } catch (papaError) {
        references = await parseCSVSimple(file);
      }
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      references = await parseExcelReferences(file);
    } else {
      throw new Error('Unsupported file format. Please use CSV or Excel files.');
    }
    
    // Filter out empty references
    references = references.filter(ref => ref.description && ref.description.trim().length > 0);
    
    return {
      references,
      totalRows: references.length,
      fileName
    };
  } catch (error) {
    throw new Error(`Failed to import references from ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates and downloads a template file
 */
export function downloadReferenceTemplate(): void {
  const csvRows = [
    'Doc Description,Date,References',
    'Project Requirements Document,2024-01-15,REQ-001',
    'Technical Specification,,TECH-002',
    'User Manual Draft,2024-01-17,',
    'API Documentation,,',
    'Test Plan Document,2024-01-19,TEST-005'
  ];
  
  const csvContent = csvRows.join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `reference_template_${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Alternative Excel template download (if you prefer Excel format)
 */
export async function downloadExcelTemplate(): Promise<void> {
  try {
    const XLSX = await import('xlsx');
    
    const templateData = [
      ['Doc Description', 'Date', 'References'],
      ['Project Requirements Document', '2024-01-15', 'REQ-001'],
      ['Technical Specification', '2024-01-16', 'TECH-002'],
      ['User Manual Draft', '2024-01-17', 'DOC-003'],
      ['API Documentation', '2024-01-18', 'API-004'],
      ['Test Plan Document', '2024-01-19', 'TEST-005']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'References');
    
    XLSX.writeFile(wb, `reference_template_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error('Failed to create Excel template, falling back to CSV:', error);
    downloadReferenceTemplate(); // Fallback to CSV
  }
}