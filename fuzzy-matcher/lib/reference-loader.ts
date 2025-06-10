// lib/reference-loader.ts - Reference Import and Template Functions

export interface ReferenceImportResult {
  references: string[];
  totalRows: number;
  fileName: string;
}

/**
 * Parses CSV file and extracts Doc Description column using Papaparse
 */
async function parseCSVReferences(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // Dynamic import of Papaparse for better compatibility
    import('papaparse').then((Papa) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';'],
        complete: (results) => {
          try {
            const data = results.data as Array<Record<string, any>>;
            
            // Find the Doc Description column (case insensitive)
            const headers = Object.keys(data[0] || {});
            const docDescHeader = headers.find(h => 
              h.toLowerCase().includes('doc description') || 
              h.toLowerCase().includes('description') ||
              h.toLowerCase() === 'doc' ||
              h.toLowerCase() === 'reference'
            );
            
            if (!docDescHeader) {
              reject(new Error('No "Doc Description" column found in CSV file. Available columns: ' + headers.join(', ')));
              return;
            }
            
            // Extract references from the column
            const references = data
              .map(row => row[docDescHeader])
              .filter(ref => ref && ref.toString().trim())
              .map(ref => ref.toString().trim());
            
            resolve(references);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    }).catch((error) => {
      reject(new Error('Failed to load CSV parser. Please ensure the file is a valid CSV.'));
    });
  });
}

/**
 * Parses Excel file and extracts Doc Description column
 */
async function parseExcelReferences(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // We'll use a dynamic import here since XLSX might not be available in all environments
        // In a real implementation, you'd import XLSX normally
        const XLSX = await import('xlsx');
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON to work with data
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        if (jsonData.length === 0) {
          resolve([]);
          return;
        }
        
        // Find Doc Description column
        const headers = jsonData[0] || [];
        const docDescIndex = headers.findIndex(h => 
          h && h.toString().toLowerCase().includes('doc description') || 
          h && h.toString().toLowerCase().includes('description') ||
          h && h.toString().toLowerCase() === 'doc' ||
          h && h.toString().toLowerCase() === 'reference'
        );
        
        if (docDescIndex === -1) {
          throw new Error('No "Doc Description" column found in Excel file');
        }
        
        // Extract references from the column
        const references: string[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] || [];
          const cellValue = row[docDescIndex];
          if (cellValue && cellValue.toString().trim()) {
            references.push(cellValue.toString().trim());
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
  
  let references: string[] = [];
  
  try {
    if (fileExtension === 'csv') {
      references = await parseCSVReferences(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      references = await parseExcelReferences(file);
    } else {
      throw new Error('Unsupported file format. Please use CSV or Excel files.');
    }
    
    // Filter out empty references
    references = references.filter(ref => ref && ref.trim().length > 0);
    
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
  // Sample data for the template
  const templateData = [
    ['Doc Description', 'References', 'Date'],
    ['Mandatory', 'Optional', 'Optional'],
    ['Sample Data', 'Please', 'Replace'],
    ['Project Requirements Document', 'REQ-001', '2024-01-15'],
    ['Technical Specification', 'TECH-002', '2024-01-16'],
    ['User Manual Draft', 'DOC-003', '2024-01-17'],
    ['API Documentation', 'API-004', '2024-01-18'],
    ['Test Plan Document', 'TEST-005', '2024-01-19']
  ];
  
  // Create CSV content
  const csvContent = templateData
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  // Create and download blob
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
  
  console.log('Reference template downloaded successfully');
}

/**
 * Alternative Excel template download (if you prefer Excel format)
 */
export async function downloadExcelTemplate(): Promise<void> {
  try {
    const XLSX = await import('xlsx');
    
    const templateData = [
      ['Doc Description', 'References', 'Date'],
      ['Project Requirements Document', 'REQ-001', '2024-01-15'],
      ['Technical Specification', 'TECH-002', '2024-01-16'],
      ['User Manual Draft', 'DOC-003', '2024-01-17'],
      ['API Documentation', 'API-004', '2024-01-18'],
      ['Test Plan Document', 'TEST-005', '2024-01-19']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'References');
    
    // Write and download
    XLSX.writeFile(wb, `reference_template_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    console.log('Excel template downloaded successfully');
  } catch (error) {
    console.error('Failed to create Excel template, falling back to CSV:', error);
    downloadReferenceTemplate(); // Fallback to CSV
  }
}