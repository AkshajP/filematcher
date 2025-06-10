// lib/folder-processor.ts - Folder Upload Processing

export interface FolderProcessingResult {
  filePaths: string[];
  totalFiles: number;
  folderName: string;
}

/**
 * Processes uploaded folder files and extracts file paths
 */
export function processFolderUpload(files: FileList): FolderProcessingResult {
  const filePaths: string[] = [];
  const folderName = files.length > 0 ? extractRootFolderName(files[0].webkitRelativePath) : '';
  
  // Convert FileList to array and process each file
  Array.from(files).forEach(file => {
    if (file.size > 0) { // Only include actual files, not directories
      // Use the webkitRelativePath which gives us the full path relative to selected folder
      const relativePath = file.webkitRelativePath;
      
      // Keep the full path including the root folder name
      filePaths.push(relativePath);
    }
  });
  
  // Sort paths for consistent ordering
  filePaths.sort((a, b) => a.localeCompare(b));
  
  console.log('Processed folder paths:', filePaths); // Debug log
  
  return {
    filePaths,
    totalFiles: filePaths.length,
    folderName
  };
}

/**
 * Extracts the root folder name from a file path
 */
function extractRootFolderName(webkitRelativePath: string): string {
  const parts = webkitRelativePath.split('/');
  return parts[0] || '';
}

/**
 * Validates if the uploaded folder contains valid files
 */
export function validateFolderUpload(files: FileList): { isValid: boolean; error?: string } {
  if (!files || files.length === 0) {
    return { isValid: false, error: 'No files selected' };
  }
  
  // Check if any actual files exist (not just directories)
  const hasFiles = Array.from(files).some(file => file.size > 0);
  if (!hasFiles) {
    return { isValid: false, error: 'No files found in the selected folder' };
  }
  
  // Check for reasonable file count (prevent accidental huge folder uploads)
  if (files.length > 10000) {
    return { isValid: false, error: 'Folder contains too many files (max 10,000)' };
  }
  
  return { isValid: true };
}