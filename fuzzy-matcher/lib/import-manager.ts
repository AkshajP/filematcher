// fuzzy-matcher/lib/import-manager.ts - Enhanced Import Manager with referenceId support

import { ExportMetadata, createFolderStructureHash } from './export-manager';
import { MatchedPair, FileReference, generateUniqueId } from './types';

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
  missingReferences: Array<{ reference: string; path: string; referenceId: string }>;
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

export interface ImportOptions {
  importExactMatches: boolean;
  importMissingAsSkipped: boolean;
  importPotentialMatches: boolean;
  restoreMissingReferences: boolean;
}

/**
 * Parses exported CSV file and extracts metadata and mappings with enhanced field support
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
    const headers = parseCSVLine(headerLine);
    
    // Detect export format version based on headers
    const hasNewFormat = headers.some(h => 
      h.toLowerCase().includes('pair id') || h.toLowerCase().includes('reference id')
    );
    
    console.log('Import format detection:', {
      headers,
      hasNewFormat,
      exportVersion: metadata?.exportVersion
    });

    // Parse data rows
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const columns = parseCSVLine(line);
        
        if (hasNewFormat && columns.length >= 9) {
          // New format: Pair ID, Reference ID, File Reference, File Path, Match Score, Timestamp, Method, Original Date, Original Reference
          const pair: MatchedPair = {
            id: generateUniqueId(), // Generate new ID for current session
            referenceId: columns[1] || generateUniqueId(), // Use imported referenceId or generate
            reference: columns[2] || '',
            path: columns[3] || '',
            score: parseFloat(columns[4]?.replace('%', '') || '0') / 100,
            timestamp: columns[5] || new Date().toISOString(),
            method: (['manual', 'auto', 'manual-bulk'].includes(columns[6]) 
                    ? columns[6] 
                    : 'manual') as 'manual' | 'auto' | 'manual-bulk',
            originalDate: columns[7] || undefined,
            originalReference: columns[8] || undefined,
            sessionId: metadata?.sessionId
          };

          if (pair.reference && pair.path) {
            mappings.push(pair);
          }
        } else if (columns.length >= 5) {
          // Legacy format: File Reference, File Path, Match Score, Timestamp, Method, Original Date, Original Reference
          const pair: MatchedPair = {
            id: generateUniqueId(),
            referenceId: generateUniqueId(), // Generate new referenceId for legacy imports
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

    console.log('Parsed mappings:', mappings.length, 'mappings');
    return { metadata, mappings, errors };
  } catch (error) {
    errors.push(`Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { mappings: [], errors };
  }
}

/**
 * Enhanced validation that handles referenceId mapping
 */
export function validateImportedMappingsAgainstCurrentState(
  importedMappings: MatchedPair[],
  currentReferences: FileReference[],
  currentFilePaths: string[],
  importedMetadata?: ExportMetadata
): ImportValidationResult {
  const exactMatches: string[] = [];
  const missingFiles: Array<{ reference: string; originalPath: string }> = [];
  const missingReferences: Array<{ reference: string; path: string; referenceId: string }> = [];
  const potentialMatches: Array<{ 
    reference: string; 
    originalPath: string; 
    suggestedPath: string; 
    similarity: number; 
  }> = [];
  const errors: string[] = [];

  const currentPathsSet = new Set(currentFilePaths);
  
  // Create maps for efficient lookup
  const currentReferencesByDescription = new Map(
    currentReferences.map(ref => [ref.description, ref])
  );

  // Validate folder structure if metadata available
  if (importedMetadata && currentFilePaths.length > 0) {
    const currentHash = createFolderStructureHash(currentFilePaths);
    const hashMatches = currentHash === importedMetadata.folderStructureHash;
    
    if (!hashMatches) {
      errors.push('Folder structure has changed since export. Some mappings may not be valid.');
    }

    const fileCountDiff = Math.abs(currentFilePaths.length - importedMetadata.totalFileCount);
    if (fileCountDiff > 0) {
      errors.push(`File count changed: ${currentFilePaths.length - importedMetadata.totalFileCount > 0 ? '+' : ''}${currentFilePaths.length - importedMetadata.totalFileCount} files`);
    }
  }

  // Check each imported mapping
  importedMappings.forEach(mapping => {
    const currentRef = currentReferencesByDescription.get(mapping.reference);
    const hasFile = currentPathsSet.has(mapping.path);

    if (currentRef && hasFile) {
      // Perfect match - update the mapping to use current reference ID
      mapping.referenceId = currentRef.id;
      exactMatches.push(mapping.path);
    } else if (!currentRef) {
      // Reference doesn't exist in current index
      missingReferences.push({
        reference: mapping.reference,
        path: mapping.path,
        referenceId: mapping.referenceId
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
  const mappedReferenceDescriptions = new Set(importedMappings.map(m => m.reference));
  const unmappedReferences = currentReferences.filter(ref => !mappedReferenceDescriptions.has(ref.description));

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
 * Enhanced import application with proper referenceId handling
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

  // Import exact matches with updated referenceIds
  if (options.importExactMatches) {
    importedMappings.forEach(mapping => {
      if (validationResult.exactMatches.includes(mapping.path)) {
        mappingsToImport.push({
          ...mapping,
          id: generateUniqueId(), // Generate new ID for current session
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
          id: generateUniqueId(),
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
        id: missingRef.referenceId, // Use the original referenceId
        description: missingRef.reference,
        isGenerated: false // These came from original client index
      });
    });
  }

  console.log('Applied import mappings:', {
    mappingsToImport: mappingsToImport.length,
    referencesToRestore: referencesToRestore.length,
    usedFilePaths: usedFilePaths.size
  });

  return {
    mappingsToImport,
    referencesToRestore,
    usedFilePaths
  };
}

// Helper functions (unchanged but included for completeness)

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