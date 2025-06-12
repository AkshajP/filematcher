// lib/import-manager.ts - Import Manager with Validation

import { MatchedPair, FileReference } from './types';
import { ExportMetadata, createFolderStructureHash } from './export-manager';

export interface ImportValidationResult {
  isValid: boolean;
  metadata?: ExportMetadata;
  mappings: MatchedPair[];
  validationSummary: {
    totalMappings: number;
    exactMatches: number;
    missingFiles: number;
    newFiles: number;
    pathChanges: number;
  };
  exactMatches: string[];
  missingFiles: Array<{ reference: string; originalPath: string }>;
  newFiles: string[];
  potentialMatches: Array<{ 
    reference: string; 
    originalPath: string; 
    suggestedPath: string; 
    similarity: number; 
  }>;
  errors: string[];
}

export interface ImportOptions {
  importExactMatches: boolean;
  importMissingAsSkipped: boolean;
  importPotentialMatches: boolean;
  restoreMissingReferences: boolean;
}

/**
 * Parses exported CSV file and extracts metadata and mappings
 */
export async function parseExportedCSV(file: File): Promise<{
  metadata?: ExportMetadata;
  mappings: MatchedPair[];
  errors: string[];
}> {
  const errors: string[] = [];
  let metadata: ExportMetadata | undefined;
  const mappings: MatchedPair[] = [];

  try {
    const content = await file.text();
    const lines = content.split('\n');
    
    // Extract metadata from comments
    const metadataLines = lines.filter(line => line.startsWith('#'));
    if (metadataLines.length > 0) {
      try {
        metadata = parseMetadataFromComments(metadataLines);
      } catch (error) {
        errors.push(`Failed to parse metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Find the header line (first non-comment line)
    const headerLineIndex = lines.findIndex(line => 
      !line.startsWith('#') && line.trim().length > 0
    );
    
    if (headerLineIndex === -1) {
      throw new Error('No data found in CSV file');
    }

    const headerLine = lines[headerLineIndex];
    const expectedHeaders = ['File Reference', 'File Path', 'Match Score', 'Timestamp', 'Method', 'Original Date', 'Original Reference'];
    
    // Validate header
    const headers = parseCSVLine(headerLine);
    const hasValidHeaders = expectedHeaders.every((expected, index) => 
      headers[index] && headers[index].toLowerCase().includes(expected.toLowerCase().replace(/\s+/g, ''))
    );

    if (!hasValidHeaders) {
      errors.push('CSV header format not recognized. Expected TERES File Mapper export format.');
    }

    // Parse data rows
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const columns = parseCSVLine(line);
        if (columns.length >= 5) {
          const pair: MatchedPair = {
            reference: columns[0] || '',
            path: columns[1] || '',
            score: parseFloat(columns[2]?.replace('%', '') || '0') / 100,
            timestamp: columns[3] || new Date().toISOString(),
            method: (['manual', 'auto', 'manual-bulk'].includes(columns[4]) 
                    ? columns[4] 
                    : 'manual') as 'manual' | 'auto' | 'manual-bulk',
            originalDate: columns[5] || undefined,
            originalReference: columns[6] || undefined,
            sessionId: metadata?.sessionId
          };

          if (pair.reference && pair.path) {
            mappings.push(pair);
          }
        }
      } catch (error) {
        errors.push(`Error parsing line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { metadata, mappings, errors };
  } catch (error) {
    errors.push(`Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { mappings: [], errors };
  }
}

/**
 * Validates imported mappings against current folder structure
 */
export function validateImportedMappings(
  importedMappings: MatchedPair[],
  currentFilePaths: string[],
  importedMetadata?: ExportMetadata
): ImportValidationResult {
  const exactMatches: string[] = [];
  const missingFiles: Array<{ reference: string; originalPath: string }> = [];
  const potentialMatches: Array<{ 
    reference: string; 
    originalPath: string; 
    suggestedPath: string; 
    similarity: number; 
  }> = [];
  const errors: string[] = [];

  const currentPathsSet = new Set(currentFilePaths);

  // Validate folder structure if metadata available
  if (importedMetadata && currentFilePaths.length > 0) {
    const currentHash = createFolderStructureHash(currentFilePaths);
    const hashMatches = currentHash === importedMetadata.folderStructureHash;
    
    if (!hashMatches) {
      errors.push('Folder structure has changed since export. Some mappings may not be valid.');
    }

    const fileCountDiff = Math.abs(currentFilePaths.length - importedMetadata.totalFileCount);
    if (fileCountDiff > 0) {
      errors.push(`File count changed: ${fileCountDiff > importedMetadata.totalFileCount ? '+' : ''}${fileCountDiff - importedMetadata.totalFileCount} files`);
    }
  }

  // Check each imported mapping
  importedMappings.forEach(mapping => {
    if (currentPathsSet.has(mapping.path)) {
      exactMatches.push(mapping.path);
    } else {
      missingFiles.push({
        reference: mapping.reference,
        originalPath: mapping.path
      });

      // Look for potential matches (same filename, different path)
      const originalFileName = mapping.path.split('/').pop() || '';
      const potentialPath = currentFilePaths.find(path => 
        path.split('/').pop() === originalFileName
      );

      if (potentialPath) {
        potentialMatches.push({
          reference: mapping.reference,
          originalPath: mapping.path,
          suggestedPath: potentialPath,
          similarity: calculatePathSimilarity(mapping.path, potentialPath)
        });
      }
    }
  });

  // Identify new files (files in current folder not in import)
  const importedPaths = new Set(importedMappings.map(m => m.path));
  const newFiles = currentFilePaths.filter(path => !importedPaths.has(path));

  const validationSummary = {
    totalMappings: importedMappings.length,
    exactMatches: exactMatches.length,
    missingFiles: missingFiles.length,
    newFiles: newFiles.length,
    pathChanges: potentialMatches.length
  };

  return {
    isValid: errors.length === 0 || exactMatches.length > 0,
    metadata: importedMetadata,
    mappings: importedMappings,
    validationSummary,
    exactMatches,
    missingFiles,
    newFiles,
    potentialMatches,
    errors
  };
}

export function validateImportedMappingsAgainstCurrentState(
  importedMappings: MatchedPair[],
  currentReferences: FileReference[],
  currentFilePaths: string[],
  importedMetadata?: ExportMetadata
): ImportValidationResult {
  const exactMatches: string[] = [];
  const missingFiles: Array<{ reference: string; originalPath: string }> = [];
  const missingReferences: Array<{ reference: string; path: string }> = [];
  const potentialMatches: Array<{ 
    reference: string; 
    originalPath: string; 
    suggestedPath: string; 
    similarity: number; 
  }> = [];
  const errors: string[] = [];

  const currentPathsSet = new Set(currentFilePaths);
  const currentReferencesSet = new Set(currentReferences.map(ref => ref.description));

  // Check each imported mapping
  importedMappings.forEach(mapping => {
    const hasReference = currentReferencesSet.has(mapping.reference);
    const hasFile = currentPathsSet.has(mapping.path);

    if (hasReference && hasFile) {
      // Perfect match
      exactMatches.push(mapping.path);
    } else if (!hasReference) {
      // Reference doesn't exist in current index
      missingReferences.push({
        reference: mapping.reference,
        path: mapping.path
      });
    } else if (!hasFile) {
      // File doesn't exist, but reference does
      missingFiles.push({
        reference: mapping.reference,
        originalPath: mapping.path
      });

      // Look for potential matches (same filename, different path)
      const originalFileName = mapping.path.split('/').pop() || '';
      const potentialPath = currentFilePaths.find(path => 
        path.split('/').pop() === originalFileName
      );

      if (potentialPath) {
        potentialMatches.push({
          reference: mapping.reference,
          originalPath: mapping.path,
          suggestedPath: potentialPath,
          similarity: calculatePathSimilarity(mapping.path, potentialPath)
        });
      }
    }
  });

  // Find references that have no mappings (new in current index)
  const mappedReferences = new Set(importedMappings.map(m => m.reference));
  const unmappedReferences = currentReferences.filter(ref => !mappedReferences.has(ref.description));

  // Find files that have no mappings (new files)
  const mappedPaths = new Set(importedMappings.map(m => m.path));
  const unmappedFiles = currentFilePaths.filter(path => !mappedPaths.has(path));

  const validationSummary = {
    totalMappings: importedMappings.length,
    exactMatches: exactMatches.length,
    missingFiles: missingFiles.length,
    newFiles: unmappedFiles.length,
    pathChanges: potentialMatches.length,
    missingReferences: missingReferences.length,
    newReferences: unmappedReferences.length
  };

  return {
    isValid: exactMatches.length > 0,
    metadata: importedMetadata,
    mappings: importedMappings,
    validationSummary,
    exactMatches,
    missingFiles,
    newFiles: unmappedFiles,
    potentialMatches,
    missingReferences,
    unmappedReferences,
    errors
  };
}

/**
 * Applies imported mappings with specified options
 */
export function applyImportedMappings(
  importedMappings: MatchedPair[],
  currentFilePaths: string[],
  options: ImportOptions,
  validationResult: ImportValidationResult
): {
  mappingsToImport: MatchedPair[];
  referencesToRestore: FileReference[];
  usedFilePaths: Set<string>;
} {
  const mappingsToImport: MatchedPair[] = [];
  const referencesToRestore: FileReference[] = [];
  const usedFilePaths = new Set<string>();

  // Import exact matches
  if (options.importExactMatches) {
    importedMappings.forEach(mapping => {
      if (validationResult.exactMatches.includes(mapping.path)) {
        mappingsToImport.push({
          ...mapping,
          timestamp: new Date().toISOString(),
        });
        usedFilePaths.add(mapping.path);
      }
    });
  }

  // Import potential matches if selected
  if (options.importPotentialMatches) {
    validationResult.potentialMatches.forEach(match => {
      const originalMapping = importedMappings.find(m => 
        m.reference === match.reference && m.path === match.originalPath
      );
      
      if (originalMapping) {
        mappingsToImport.push({
          ...originalMapping,
          path: match.suggestedPath,
          timestamp: new Date().toISOString(),
          method: 'auto' as const
        });
        usedFilePaths.add(match.suggestedPath);
      }
    });
  }

  // Restore missing references if selected
  if (options.restoreMissingReferences && validationResult.missingReferences) {
    validationResult.missingReferences.forEach(missingRef => {
      referencesToRestore.push({
        description: missingRef.reference,
        isGenerated: false // These came from original client index
      });
    });
  }

  return {
    mappingsToImport,
    referencesToRestore,
    usedFilePaths
  };
}

// Helper functions

function parseMetadataFromComments(commentLines: string[]): ExportMetadata {
  const metadata: Partial<ExportMetadata> = {};
  
  commentLines.forEach(line => {
    if (line.includes('Export Version:')) {
      metadata.exportVersion = extractValue(line);
    } else if (line.includes('Export Timestamp:')) {
      metadata.exportTimestamp = extractValue(line);
    } else if (line.includes('Folder Name:')) {
      metadata.folderName = extractValue(line);
    } else if (line.includes('Folder Structure Hash:')) {
      metadata.folderStructureHash = extractValue(line);
    } else if (line.includes('Total File Count:')) {
      metadata.totalFileCount = parseInt(extractValue(line)) || 0;
    } else if (line.includes('Session ID:')) {
      metadata.sessionId = extractValue(line);
    }
  });

  if (!metadata.folderName || !metadata.folderStructureHash) {
    throw new Error('Required metadata fields missing');
  }

  return metadata as ExportMetadata;
}

export interface ImportValidationResult {
  isValid: boolean;
  metadata?: ExportMetadata;
  mappings: MatchedPair[];
  validationSummary: {
    totalMappings: number;
    exactMatches: number;
    missingFiles: number;
    newFiles: number;
    pathChanges: number;
    missingReferences: number;
    newReferences: number;
  };
  exactMatches: string[];
  missingFiles: Array<{ reference: string; originalPath: string }>;
  missingReferences: Array<{ reference: string; path: string }>;
  newFiles: string[];
  unmappedReferences: FileReference[];
  potentialMatches: Array<{ 
    reference: string; 
    originalPath: string; 
    suggestedPath: string; 
    similarity: number; 
  }>;
  errors: string[];
}

function extractValue(commentLine: string): string {
  const colonIndex = commentLine.indexOf(':');
  return colonIndex !== -1 ? commentLine.substring(colonIndex + 1).trim() : '';
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function calculatePathSimilarity(path1: string, path2: string): number {
  const parts1 = path1.split('/');
  const parts2 = path2.split('/');
  
  // Same filename gets high score
  if (parts1[parts1.length - 1] === parts2[parts2.length - 1]) {
    return 0.8;
  }
  
  // Calculate directory overlap
  const dirs1 = parts1.slice(0, -1);
  const dirs2 = parts2.slice(0, -1);
  const commonDirs = dirs1.filter(dir => dirs2.includes(dir));
  
  return commonDirs.length / Math.max(dirs1.length, dirs2.length);
}