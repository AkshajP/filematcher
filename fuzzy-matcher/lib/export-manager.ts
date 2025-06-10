// lib/export-manager.ts - Enhanced Export with Metadata

import { MatchedPair } from './types';

export interface ExportMetadata {
  folderName: string;
  folderStructureHash: string;
  totalFileCount: number;
  exportVersion: string;
  exportTimestamp: string;
  sessionId: string;
}

export interface EnhancedExportData {
  metadata: ExportMetadata;
  mappings: MatchedPair[];
}

/**
 * Creates a lightweight hash of folder structure for validation
 */
export function createFolderStructureHash(filePaths: string[]): string {
  // Create a simple hash based on:
  // - Total file count
  // - Sorted list of directory names
  // - First and last few file names (sorted)
  
  const directories = new Set<string>();
  const sortedPaths = [...filePaths].sort();
  
  filePaths.forEach(path => {
    const parts = path.split('/');
    parts.slice(0, -1).forEach(dir => {
      if (dir) directories.add(dir);
    });
  });
  
  const dirList = Array.from(directories).sort();
  const samplePaths = [
    ...sortedPaths.slice(0, 5),  // First 5 files
    ...sortedPaths.slice(-5)     // Last 5 files
  ].join('|');
  
  const hashInput = `${filePaths.length}:${dirList.join(',')}:${samplePaths}`;
  
  // Simple hash function (for folder structure fingerprinting)
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Enhanced export function with metadata
 */
export function exportMappingsWithMetadata(
  matchedPairs: MatchedPair[],
  filePaths: string[],
  folderName: string,
  sessionId: string
): string {
  const metadata: ExportMetadata = {
    folderName,
    folderStructureHash: createFolderStructureHash(filePaths),
    totalFileCount: filePaths.length,
    exportVersion: '1.0',
    exportTimestamp: new Date().toISOString(),
    sessionId
  };

  // Create enhanced CSV with metadata header
  const csvRows: string[] = [];
  
  // Add metadata as comments at the top
  csvRows.push('# TERES File Mapper Export Metadata');
  csvRows.push(`# Export Version: ${metadata.exportVersion}`);
  csvRows.push(`# Export Timestamp: ${metadata.exportTimestamp}`);
  csvRows.push(`# Folder Name: ${metadata.folderName}`);
  csvRows.push(`# Folder Structure Hash: ${metadata.folderStructureHash}`);
  csvRows.push(`# Total File Count: ${metadata.totalFileCount}`);
  csvRows.push(`# Session ID: ${metadata.sessionId}`);
  csvRows.push('# ');
  
  // Add CSV header
  csvRows.push('File Reference,File Path,Match Score,Timestamp,Method,Original Date,Original Reference');
  
  // Add mapping data
  matchedPairs.forEach(pair => {
    const row = [
      pair.reference,
      pair.path,
      `${(pair.score * 100).toFixed(1)}%`,
      pair.timestamp,
      pair.method,
      pair.originalDate || '',
      pair.originalReference || ''
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    
    csvRows.push(row);
  });

  return csvRows.join('\n');
}

/**
 * Extracts the original folder name from file paths
 */
export function extractFolderName(filePaths: string[]): string {
  if (filePaths.length === 0) return 'Unknown';
  
  // Get the root folder name from the first path
  const firstPath = filePaths[0];
  const parts = firstPath.split('/');
  return parts[0] || 'Unknown';
}