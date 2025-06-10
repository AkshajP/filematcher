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
  // This function is now only used for explicit file imports
  // The app starts with empty state by default
  console.log('loadDataSources called - this should only happen for explicit imports');
  
  try {
    // In a real Next.js app, you'd load from API routes or static files
    // For now, return empty data
    console.log('Returning empty data sources');
    return getFallbackData();
  } catch (error) {
    console.error('Error loading data sources:', error);
    return getFallbackData();
  }
}