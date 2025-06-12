// lib/data-loader.ts - Updated Data Loading Functions

import { FileReference, generateUniqueId } from './types';

export interface DataSources {
  fileReferences: FileReference[];
  filePaths: string[];
  source: 'fallback' | 'folder-upload' | 'file-upload';
  folderName?: string;
}

// Parse file references from Doc Description.txt format
function parseFileReferences(content: string): FileReference[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => ({
    description: line.trim(),
    isGenerated: false
  }));
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
  const fileReferences: FileReference[] = [];
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

export async function loadFromFolder(files: FileList): Promise<{ filePaths: string[]; folderName: string }> {
  const filePaths: string[] = [];
  let folderName = 'Unknown';

  for (const file of Array.from(files)) {
    if (file.webkitRelativePath) {
      // This is from a folder upload - collect all file paths
      filePaths.push(file.webkitRelativePath);
      
      // Extract folder name from the first file
      if (folderName === 'Unknown') {
        folderName = extractFolderNameFromPaths([file.webkitRelativePath]);
      }
    }
  }

  console.log(`Loaded ${filePaths.length} file paths from folder structure: ${folderName}`);
  return { filePaths, folderName };
}

function extractFolderNameFromPaths(filePaths: string[]): string {
  if (filePaths.length === 0) return 'Unknown';
  
  // Get the root folder name from the first path
  const firstPath = filePaths[0];
  const parts = firstPath.split('/');
  return parts[0] || 'Unknown';
}


// Add empty data source function
export function getEmptyDataSources(): DataSources {
  return { source: 'fallback', fileReferences: [], filePaths: [] };
}