// lib/data-loader.ts - Updated Data Loading Functions

export interface DataSources {
  fileReferences: string[];
  filePaths: string[];
  source: 'fallback' | 'folder-upload' | 'file-upload';
  folderName?: string;
}

// Parse file references from Doc Description.txt format
function parseFileReferences(content: string): string[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => line.trim());
}

// Parse file paths from matchings.txt format
function parseFilePaths(content: string): string[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => line.trim().replace(/^"|"$/g, '').replace(/",?$/, ''));
}

// Fallback data (empty state)
function getFallbackData(): DataSources {
  return { 
    fileReferences: [],
    filePaths: [],
    source: 'fallback' 
  };
}

// Create data sources from uploaded folder
export function createDataFromFolder(filePaths: string[], folderName: string): DataSources {
  // Start with empty references - user will need to provide these separately
  // or we could auto-generate some basic references from file names
  return {
    fileReferences: [], // Empty for now, can be populated later
    filePaths: filePaths,
    source: 'folder-upload',
    folderName: folderName
  };
}

// Load data from files (only used for explicit file imports, not automatic initialization)
export async function loadDataSources(): Promise<DataSources> {
  // This should only be called for fallback/demo data
  console.log('Loading fallback demo data');
  return getFallbackData();
}

export async function loadFromFiles(files: FileList): Promise<DataSources> {
  const fileReferences: string[] = [];
  const filePaths: string[] = [];

  for (const file of Array.from(files)) {
    if (file.name.toLowerCase().includes('description') && file.name.endsWith('.txt')) {
      // This is a file references file
      const content = await file.text();
      const refs = parseFileReferences(content);
      fileReferences.push(...refs);
    } else if (file.name.toLowerCase().includes('matching') && file.name.endsWith('.txt')) {
      // This is a file paths file
      const content = await file.text();
      const paths = parseFilePaths(content);
      filePaths.push(...paths);
    }
  }

  console.log(`Loaded ${fileReferences.length} references and ${filePaths.length} file paths from files`);
  return {source: 'folder-upload', fileReferences, filePaths };
}

export async function loadFromFolder(files: FileList): Promise<string[]> {
  const filePaths: string[] = [];

  for (const file of Array.from(files)) {
    if (file.webkitRelativePath) {
      // This is from a folder upload - collect all file paths
      filePaths.push(file.webkitRelativePath);
    }
  }

  console.log(`Loaded ${filePaths.length} file paths from folder structure`);
  return filePaths;
}


// Helper function to generate references from file paths
function generateReferencesFromPaths(filePaths: string[]): string[] {
  return filePaths.map(filePath => {
    const parts = filePath.split('/');
    const fileName = parts.pop() || '';
    let referenceName = fileName.replace(/\.[^/.]+$/, '');
    
    referenceName = referenceName
      .replace(/^\w+-/, '')
      .replace(/^RDCC-APPENDIX-\d+-\d+\s*-\s*/, '')
      .replace(/^(ELM-WAH-LTR-\d+|C0+\d+|D0+\d+|B0+\d+)\s*-?\s*/i, '')
      .replace(/dated\s+\d+\s+\w+\s+\d+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
      
    const parentFolder = parts[parts.length - 1];
    if (parts.length > 2 && parentFolder && !referenceName.toLowerCase().includes(parentFolder.toLowerCase())) {
      referenceName = `${parentFolder} - ${referenceName}`;
    }
    
    return referenceName || fileName;
  });
}

// Update the existing loadDataSources function


// Add empty data source function
export function getEmptyDataSources(): DataSources {
  return { source: 'fallback', fileReferences: [], filePaths: [] };
}