// app/new-mapper/page.tsx - Enhanced with Workflow System
'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { WorkflowHeader } from '@/components/workflow-header';
import { FileReferences } from '@/components/file-references';
import { NewDocumentSelector } from '@/components/new-document-selector';
import { MatchedPairs } from '@/components/matched-pairs';
import { ImportValidationDialog } from '@/components/import-validation-dialog';
import { Badge } from '@/components/ui/badge';
import { FileReference, MatchedPair, generateUniqueId } from '@/lib/types';
import { loadFromFolder } from '@/lib/data-loader';
import { importReferencesFromFile, downloadReferenceTemplate } from '@/lib/reference-loader';
import { exportMappingsWithMetadata } from '@/lib/export-manager';
import { parseExportedCSV, validateImportedMappingsAgainstCurrentState, applyImportedMappings, ImportValidationResult, ImportOptions } from '@/lib/import-manager';

interface OrderedSelection {
  item: DocumentFile;
  order: number;
}

interface DocumentFile {
  id: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  dateModified?: string;
  fileType?: string;
}

type ActiveTab = 'matching' | 'completed';
type WorkflowMode = 'setup' | 'working';

export default function NewMapperPage() {
  // Workflow state management
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('setup');
  
  // Real data state (replacing placeholder data)
  const [fileReferences, setFileReferences] = useState<FileReference[]>([]);
  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
  const [folderName, setFolderName] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [sessionId] = useState<string>(() => generateUniqueId());
  
  // Interaction state management
  const [selectedReferences, setSelectedReferences] = useState<Array<{ item: FileReference; order: number }>>([]);
  const [currentReference, setCurrentReference] = useState<FileReference | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<OrderedSelection[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<MatchedPair[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('matching');
  
  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(33);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [startWidth, setStartWidth] = useState<number>(33);

  // Import state management
  const [importDialog, setImportDialog] = useState<{
    isOpen: boolean;
    validationResult?: ImportValidationResult;
    awaitingFolder?: boolean;
    pendingImportData?: unknown;
    isProcessing?: boolean;
  }>({ isOpen: false });

  // Workflow status tracking
  const indexStatus = {
    loaded: fileReferences.length > 0,
    count: fileReferences.length,
    fileName: 'Client Index'
  };

  const folderStatus = {
    loaded: documentFiles.length > 0,
    count: documentFiles.length,
    folderName: folderName || 'Project Folder'
  };

  const bothLoaded = indexStatus.loaded && folderStatus.loaded;

  // Auto-transition to working mode when both are loaded
  useEffect(() => {
    if (bothLoaded && workflowMode === 'setup') {
      setWorkflowMode('working');
      // Set first reference as current when transitioning to working mode
      if (fileReferences.length > 0) {
        setCurrentReference(fileReferences[0]);
      }
    }
  }, [bothLoaded, workflowMode, fileReferences]);

  // File Upload Handlers
  const handleImportReferences = async (files: FileList) => {
    try {
      setIsLoadingFiles(true);
      const file = files[0];
      const result = await importReferencesFromFile(file);
      
      setFileReferences(result.references);
      console.log(`Imported ${result.references.length} references from ${result.fileName}`);
    } catch (error) {
      console.error('Failed to import references:', error);
      alert(`Failed to import references: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleImportFolder = async (files: FileList) => {
    try {
      setIsLoadingFiles(true);
      const result = await loadFromFolder(files);
      
      if (!result || !result.filePaths) {
        throw new Error('Invalid folder data returned');
      }
      
      const { filePaths, folderName: loadedFolderName } = result;
      
      // Convert file paths to DocumentFile format with proper metadata extraction
      const documents: DocumentFile[] = filePaths.map((filePath, index) => {
        // Parse the file path properly
        const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
        const fileName = pathParts[pathParts.length - 1] || filePath;
        
        // Extract file extension
        const extensionMatch = fileName.match(/\.([^.]+)$/);
        const fileExtension = extensionMatch ? extensionMatch[1].toLowerCase() : '';
        
        // Generate realistic file sizes based on file type
        const getFileSize = (ext: string): number => {
          const sizes = {
            'pdf': Math.floor(Math.random() * 3000000) + 500000,    // 0.5-3.5MB
            'docx': Math.floor(Math.random() * 2000000) + 200000,   // 0.2-2.2MB
            'xlsx': Math.floor(Math.random() * 1500000) + 300000,   // 0.3-1.8MB
            'jpg': Math.floor(Math.random() * 4000000) + 1000000,   // 1-5MB
            'png': Math.floor(Math.random() * 3000000) + 800000,    // 0.8-3.8MB
            'txt': Math.floor(Math.random() * 100000) + 10000,      // 10-110KB
            'default': Math.floor(Math.random() * 1000000) + 100000 // 0.1-1.1MB
          };
          return sizes[ext] || sizes['default'];
        };
        
        // Generate realistic modification dates
        const getModifiedDate = (): string => {
          const now = new Date();
          const pastDays = Math.floor(Math.random() * 365); // Within last year
          const modDate = new Date(now.getTime() - (pastDays * 24 * 60 * 60 * 1000));
          return modDate.toISOString().split('T')[0];
        };
        
        return {
          id: `doc-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filePath: normalizedPath,
          fileName,
          fileType: fileExtension || 'unknown',
          fileSize: getFileSize(fileExtension),
          dateModified: getModifiedDate()
        };
      });
      
      // Validate the converted documents
      const validDocuments = documents.filter(doc => 
        doc.id && doc.filePath && doc.fileName && typeof doc.fileSize === 'number'
      );
      
      if (validDocuments.length !== documents.length) {
        console.warn(`${documents.length - validDocuments.length} documents failed validation`);
      }
      
      setDocumentFiles(validDocuments);
      setFolderName(loadedFolderName || 'Imported Folder');
      
      console.log(`Imported ${filePaths.length} file paths from folder: ${loadedFolderName}`);
      console.log('Sample converted documents:', validDocuments.slice(0, 3));
      console.log('Sample file paths:', filePaths.slice(0, 5));
    } catch (error) {
      console.error('Failed to import folder:', error);
      alert('Failed to import folder. Please try again.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadReferenceTemplate();
  };

  // Calculate unmatched references for the workflow header
  const unmatchedReferences = useMemo(() => {
  // Create a Set of reference IDs that have already been matched for fast lookups
  const matchedReferenceIds = new Set(matchedPairs.map(pair => pair.referenceId));
  
  // Filter the original fileReferences list, keeping only those whose ID is not in the matched set
  const unmatched = fileReferences.filter(ref => !matchedReferenceIds.has(ref.id));
  
  console.log('Unmatched references calculation:', {
    totalReferences: fileReferences.length,
    matchedCount: matchedReferenceIds.size,
    unmatchedCount: unmatched.length,
    matchedIds: Array.from(matchedReferenceIds)
  });
  
  return unmatched;
}, [fileReferences, matchedPairs]);

const availableDocuments = useMemo(() => {
  const usedPaths = new Set(matchedPairs.map(pair => pair.path));
  const available = documentFiles.filter(doc => !usedPaths.has(doc.filePath));
  
  console.log('Available documents calculation:', {
    totalDocuments: documentFiles.length,
    usedPaths: usedPaths.size,
    availableCount: available.length
  });
  
  return available;
}, [documentFiles, matchedPairs]);

// Add this debug function to verify referenceId consistency (temporary for debugging):
const verifyReferenceIds = useCallback(() => {
  console.log('=== Reference ID Verification ===');
  
  // Check if all fileReferences have IDs
  const referencesWithoutIds = fileReferences.filter(ref => !ref.id);
  if (referencesWithoutIds.length > 0) {
    console.error('References without IDs:', referencesWithoutIds);
  }
  
  // Check if all matchedPairs have referenceIds
  const pairsWithoutReferenceIds = matchedPairs.filter(pair => !pair.referenceId);
  if (pairsWithoutReferenceIds.length > 0) {
    console.error('Matched pairs without referenceIds:', pairsWithoutReferenceIds);
  }
  
  // Check for orphaned pairs (referenceId doesn't exist in fileReferences)
  const allReferenceIds = new Set(fileReferences.map(ref => ref.id));
  const orphanedPairs = matchedPairs.filter(pair => !allReferenceIds.has(pair.referenceId));
  if (orphanedPairs.length > 0) {
    console.warn('Orphaned matched pairs (referenceId not found in references):', orphanedPairs);
  }
  
  console.log('Reference ID verification complete');
}, [fileReferences, matchedPairs]);
  // Filter current selections to only include unmapped references
  const validSelectedReferences = useMemo(() => {
    return selectedReferences.filter(sel => 
      unmatchedReferences.some(ref => ref.id === sel.item.id)
    );
  }, [selectedReferences, unmatchedReferences]);

  const validCurrentReference = useMemo(() => {
    if (!currentReference) return null;
    return unmatchedReferences.find(ref => ref.id === currentReference.id) || null;
  }, [currentReference, unmatchedReferences]);

  const hasValidReferencesToMap = useMemo(() => {
    return validSelectedReferences.length > 0 || validCurrentReference !== null;
  }, [validSelectedReferences.length, validCurrentReference]);

  // Auto-manage state when references become mapped/unmapped
  useEffect(() => {
    // Clear selected references that are no longer valid
    if (validSelectedReferences.length !== selectedReferences.length) {
      setSelectedReferences(validSelectedReferences);
    }
    
    // Handle current reference state changes
    if (currentReference && !validCurrentReference) {
      // Current reference became invalid (was mapped) - set to first available
      setCurrentReference(unmatchedReferences[0] || null);
    } else if (!currentReference && unmatchedReferences.length > 0 && validSelectedReferences.length === 0) {
      // No current reference but unmapped references are available
      setCurrentReference(unmatchedReferences[0]);
    }
    
    // Clear document selections when there are no valid references
    if (!hasValidReferencesToMap && selectedDocuments.length > 0) {
      setSelectedDocuments([]);
    }
  }, [validSelectedReferences, validCurrentReference, hasValidReferencesToMap, selectedReferences, currentReference, unmatchedReferences, selectedDocuments.length]);

  // File References handlers
  const handleSelectReference = useCallback((reference: FileReference) => {
    setCurrentReference(reference);
    setSelectedReferences([]);
    setSelectedDocuments([]);
  }, []);

  const handleToggleReferenceSelection = useCallback((reference: FileReference) => {
    setSelectedReferences(prev => {
      const existing = prev.find(item => item.item.id === reference.id);
      if (existing) {
        return prev.filter(item => item.item.id !== reference.id);
      } else {
        const usedOrders = new Set(prev.map(item => item.order));
        let nextOrder = 1;
        while (usedOrders.has(nextOrder)) {
          nextOrder++;
        }
        return [...prev, { item: reference, order: nextOrder }];
      }
    });
    setSelectedDocuments([]);
  }, []);

  const handleSelectAllReferences = useCallback(() => {
    const allSelected = selectedReferences.length === unmatchedReferences.length;
    if (allSelected) {
      setSelectedReferences([]);
    } else {
      const newSelected = unmatchedReferences.map((ref, index) => ({
        item: ref,
        order: index + 1
      }));
      setSelectedReferences(newSelected);
    }
    setSelectedDocuments([]);
  }, [selectedReferences.length, unmatchedReferences]);

  const handleBulkSkip = useCallback(() => {
    console.log('Bulk skip selected references:', selectedReferences);
    setSelectedReferences([]);
  }, [selectedReferences]);

  const handleBulkDeselect = useCallback(() => {
    setSelectedReferences([]);
    setSelectedDocuments([]);
  }, []);

  const handleDetectRemaining = useCallback(() => {
    console.log('Detect remaining files');
  }, []);

  // Document selector handlers
  const handleDocumentSelectionChange = useCallback((selections: OrderedSelection[]) => {
    setSelectedDocuments(selections);
    console.log('Document selections changed:', selections);
  }, []);

  const handleConfirmMapping = useCallback(() => {
  if (!hasValidReferencesToMap) {
    console.log('No valid references to map');
    return;
  }

  // Bulk mapping
  if (validSelectedReferences.length > 0 && selectedDocuments.length > 0) {
    const sortedRefs = validSelectedReferences.sort((a, b) => a.order - b.order);
    const sortedDocs = selectedDocuments.sort((a, b) => a.order - b.order);
    
    const newMappings: MatchedPair[] = [];
    const maxPairs = Math.min(sortedRefs.length, sortedDocs.length);
    
    for (let i = 0; i < maxPairs; i++) {
      const ref = sortedRefs[i].item;
      const doc = sortedDocs[i].item;
      
      // Ensure the reference has an ID
      if (!ref.id) {
        console.error('Reference missing ID:', ref);
        continue;
      }
      
      newMappings.push({
        id: generateUniqueId(),
        referenceId: ref.id, // Use the reference's unique ID
        reference: ref.description,
        path: doc.filePath,
        score: 1.0,
        timestamp: new Date().toISOString(),
        method: validSelectedReferences.length > 1 ? 'manual-bulk' : 'manual',
        sessionId: sessionId,
        originalDate: ref.date,
        originalReference: ref.reference,
      });
    }
    
    console.log('Creating bulk mappings:', newMappings.length);
    setMatchedPairs(prev => [...prev, ...newMappings]);
    setSelectedReferences([]);
    setSelectedDocuments([]);
    
  } else if (validCurrentReference && selectedDocuments.length === 1) {
    // Single mapping
    if (!validCurrentReference.id) {
      console.error('Current reference missing ID:', validCurrentReference);
      return;
    }
    
    const newMapping: MatchedPair = {
      id: generateUniqueId(),
      referenceId: validCurrentReference.id, // Use the reference's unique ID
      reference: validCurrentReference.description,
      path: selectedDocuments[0].item.filePath,
      score: 1.0,
      timestamp: new Date().toISOString(),
      method: 'manual',
      sessionId: sessionId,
      originalDate: validCurrentReference.date,
      originalReference: validCurrentReference.reference,
    };
    
    console.log('Creating single mapping:', newMapping);
    setMatchedPairs(prev => [...prev, newMapping]);
    setSelectedDocuments([]);
  }
}, [validSelectedReferences, selectedDocuments, validCurrentReference, hasValidReferencesToMap, sessionId]);

  // Remove matched pair by ID for stability
  const handleRemoveMatch = useCallback((pairId: string) => {
  console.log('Removing mapping with ID:', pairId);
  
  // Find the pair being removed to get its details
  const pairToRemove = matchedPairs.find(pair => pair.id === pairId);
  
  if (!pairToRemove) {
    console.warn('Pair not found for deletion:', pairId);
    return;
  }
  
  console.log('Removing mapping:', {
    referenceId: pairToRemove.referenceId,
    reference: pairToRemove.reference,
    path: pairToRemove.path
  });
  
  // Remove the pair from matchedPairs
  setMatchedPairs(prev => {
    const newPairs = prev.filter(pair => pair.id !== pairId);
    console.log('Updated matched pairs count:', newPairs.length);
    return newPairs;
  });
  
  // Note: The reference will automatically become available again through the
  // unmatchedReferences calculation since it uses referenceId to exclude matched items.
  // The document will also automatically become available since availableDocuments
  // filters out paths that exist in matchedPairs.
  
  // Clear any current selections that might reference the deleted pair
  setSelectedReferences([]);
  setSelectedDocuments([]);
  
  // Force refresh of the document selector to update available documents
  // This ensures the UI immediately reflects the newly available document
  setTimeout(() => {
    console.log('Deletion completed for pair:', pairId);
  }, 100);
  
}, [matchedPairs]);

  // Resize handling functions
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(leftPanelWidth);
    e.preventDefault();
  }, [leftPanelWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const containerWidth = window.innerWidth;
    const newWidthPercent = startWidth + (deltaX / containerWidth) * 100;
    
    // Constrain between 20% and 60%
    const constrainedWidth = Math.min(Math.max(newWidthPercent, 20), 60);
    setLeftPanelWidth(constrainedWidth);
  }, [isResizing, startX, startWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Placeholder handlers for workflow actions
  const handleStartAutoMatch = () => {
    console.log('Auto match functionality not implemented yet');
    // TODO: Implement auto-match functionality
  };

  const handleImportMappings = async (files: FileList) => {
    try {
      const file = files[0];
      const { metadata, mappings, errors } = await parseExportedCSV(file);
      
      if (errors.length > 0) {
        console.warn('CSV parsing errors:', errors);
        if (mappings.length === 0) {
          alert(`Failed to parse mappings file:\n${errors.join('\n')}`);
          return;
        }
      }

      if (mappings.length === 0) {
        alert('No valid mappings found in the file.');
        return;
      }

      if (documentFiles.length === 0 || fileReferences.length === 0) {
        alert('Please first upload both:\n1. Your client index (Upload Index)\n2. Your folder structure (Upload Folder)\n\nThen try importing mappings again.');
        return;
      }

      // Convert documentFiles back to filePaths for validation
      const filePaths = documentFiles.map(doc => doc.filePath);

      const validationResult = validateImportedMappingsAgainstCurrentState(
        mappings, 
        fileReferences, 
        filePaths, 
        metadata
      );
      
      setImportDialog({
        isOpen: true,
        validationResult
      });
    } catch (error) {
      console.error('Failed to import mappings:', error);
      alert(`Failed to import mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

 const handleImportConfirm = async (options: ImportOptions) => {
  if (!importDialog.validationResult) return;

  try {
    setImportDialog(prev => ({ ...prev, isProcessing: true }));

    const filePaths = documentFiles.map(doc => doc.filePath);
    const { mappingsToImport, referencesToRestore, usedFilePaths } = applyImportedMappings(
      importDialog.validationResult.mappings,
      filePaths,
      options,
      importDialog.validationResult
    );

    console.log('Import application result:', {
      mappingsToImport: mappingsToImport.length,
      referencesToRestore: referencesToRestore.length,
      usedFilePaths: usedFilePaths.size
    });

    // Step 1: Restore missing references first (these need to exist before mappings)
    if (referencesToRestore.length > 0) {
      setFileReferences(prev => {
        // Check for existing references to avoid duplicates
        const existingIds = new Set(prev.map(ref => ref.id));
        const existingDescriptions = new Set(prev.map(ref => ref.description));
        
        const newReferences = referencesToRestore.filter(ref => 
          !existingIds.has(ref.id) && !existingDescriptions.has(ref.description)
        );
        
        console.log('Restoring references:', {
          total: referencesToRestore.length,
          new: newReferences.length,
          existing: referencesToRestore.length - newReferences.length
        });
        
        return [...prev, ...newReferences];
      });
    }

    // Step 2: Validate and update mappings to ensure proper referenceId linkage
    const validatedMappings = mappingsToImport.map(mapping => {
      // Verify the referenceId exists in our current references (including newly restored ones)
      const updatedReferences = [...fileReferences, ...referencesToRestore];
      const matchingRef = updatedReferences.find(ref => 
        ref.id === mapping.referenceId || ref.description === mapping.reference
      );
      
      if (matchingRef) {
        return {
          ...mapping,
          referenceId: matchingRef.id, // Ensure we use the correct current referenceId
          sessionId: sessionId // Update to current session
        };
      } else {
        console.warn('No matching reference found for mapping:', mapping);
        return mapping;
      }
    });

    // Step 3: Apply validated mappings to current state
    setMatchedPairs(prev => {
      // Check for duplicate paths to avoid conflicts
      const existingPaths = new Set(prev.map(pair => pair.path));
      const newMappings = validatedMappings.filter(mapping => !existingPaths.has(mapping.path));
      
      console.log('Adding mappings:', {
        total: validatedMappings.length,
        new: newMappings.length,
        duplicates: validatedMappings.length - newMappings.length
      });
      
      return [...prev, ...newMappings];
    });

    setImportDialog({ isOpen: false });
    
    let message = `Successfully imported ${validatedMappings.length} mappings`;
    if (referencesToRestore.length > 0) {
      message += ` and restored ${referencesToRestore.length} missing references`;
    }
    alert(message + '.');
    
  } catch (error) {
    console.error('Failed to apply import:', error);
    alert(`Failed to apply import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    setImportDialog(prev => ({ ...prev, isProcessing: false }));
  }
};

  const validateImportedData = useCallback(() => {
  console.log('=== Import Data Validation ===');
  
  // Check for mappings with invalid referenceIds
  const invalidMappings = matchedPairs.filter(pair => {
    const hasValidReferenceId = fileReferences.some(ref => ref.id === pair.referenceId);
    return !hasValidReferenceId;
  });
  
  if (invalidMappings.length > 0) {
    console.warn('Mappings with invalid referenceIds:', invalidMappings);
  }
  
  // Check for duplicate referenceIds in mappings
  const referenceIdCounts = new Map<string, number>();
  matchedPairs.forEach(pair => {
    const count = referenceIdCounts.get(pair.referenceId) || 0;
    referenceIdCounts.set(pair.referenceId, count + 1);
  });
  
  const duplicateReferenceIds = Array.from(referenceIdCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
  
  if (duplicateReferenceIds.length > 0) {
    console.warn('Duplicate referenceIds in mappings:', duplicateReferenceIds);
  }
  
  console.log('Import validation summary:', {
    totalMappings: matchedPairs.length,
    totalReferences: fileReferences.length,
    invalidMappings: invalidMappings.length,
    duplicateReferenceIds: duplicateReferenceIds.length
  });
}, [fileReferences, matchedPairs]);


  const handleImportCancel = () => {
    setImportDialog({ isOpen: false });
  };

  const handleImportMappingsWorkflow = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleImportMappings(files);
      }
    };
    input.click();
  };

  const handleExport = () => {
    try {
      if (matchedPairs.length === 0) {
        alert('No mappings to export. Please create some mappings first.');
        return;
      }

      // Convert documentFiles back to filePaths array for export
      const filePaths = documentFiles.map(doc => doc.filePath);
      
      if (filePaths.length === 0) {
        alert('No file structure loaded. Please upload a folder first.');
        return;
      }

      // Use the professional export system
      const csvContent = exportMappingsWithMetadata(
        matchedPairs,
        filePaths,
        folderName || 'Unknown Folder',
        sessionId
      );

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `teres-file-mappings-${timestamp}.csv`;
        
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up
        
        console.log(`Exported ${matchedPairs.length} mappings to ${fileName}`);
        alert(`Successfully exported ${matchedPairs.length} mappings to ${fileName}`);
      } else {
        throw new Error('File download not supported in this browser');
      }
    } catch (error) {
      console.error('Failed to export mappings:', error);
      alert(`Failed to export mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Show loading state during setup
  if (workflowMode === 'setup') {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <WorkflowHeader
          indexStatus={indexStatus}
          folderStatus={folderStatus}
          currentMode={workflowMode}
          onUploadIndex={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.xlsx,.xls';
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) handleImportReferences(files);
            };
            input.click();
          }}
          onUploadFolder={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) handleImportFolder(files);
            };
            input.click();
          }}
          onDownloadTemplate={handleDownloadTemplate}
          onStartAutoMatch={handleStartAutoMatch}
          onImportMappings={handleImportMappings}
          onExport={handleExport}
          unmappedCount={unmatchedReferences.length}
        />
        
        {/* Setup completion indicator */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            {isLoadingFiles ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mx-auto mb-4"></div>
                <p className="text-lg mb-2">Processing files...</p>
                <p className="text-sm">Please wait while we load your data</p>
              </>
            ) : (
              <>
                <p className="text-lg mb-2">Upload your files to begin mapping</p>
                <p className="text-sm">Follow the steps above to load your client index and file structure</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main working interface
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <WorkflowHeader
        indexStatus={indexStatus}
        folderStatus={folderStatus}
        currentMode={workflowMode}
        onUploadIndex={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.csv,.xlsx,.xls';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleImportReferences(files);
          };
          input.click();
        }}
        onUploadFolder={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.webkitdirectory = true;
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleImportFolder(files);
          };
          input.click();
        }}
        onDownloadTemplate={handleDownloadTemplate}
        onStartAutoMatch={handleStartAutoMatch}
        onImportMappings={handleImportMappingsWorkflow}
        onExport={handleExport}
        mappingProgress={{
          completed: matchedPairs.length,
          total: fileReferences.length
        }}
        unmappedCount={unmatchedReferences.length}
      />

      {/* Status Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-700 border-green-300">
                {fileReferences.length} References
              </Badge>
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                {documentFiles.length} Documents
              </Badge>
              <Badge variant="outline" className="text-purple-700 border-purple-300">
                {matchedPairs.length} Mapped
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('matching')}
              className={`px-3 py-1 rounded text-sm ${
                activeTab === 'matching'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Mapping ({unmatchedReferences.length} remaining)
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1 rounded text-sm ${
                activeTab === 'completed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Completed ({matchedPairs.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {activeTab === 'matching' ? (
          <>
            {/* Left Panel - File References */}
            <div 
              className="bg-white border-r border-gray-200 flex flex-col"
              style={{ width: `${leftPanelWidth}%` }}
            >
              <FileReferences
                references={unmatchedReferences}
                currentReference={validCurrentReference}
                selectedReferences={validSelectedReferences}
                onSelectReference={handleSelectReference}
                onToggleSelection={handleToggleReferenceSelection}
                onSelectAll={handleSelectAllReferences}
                onBulkSkip={handleBulkSkip}
                onBulkDeselect={handleBulkDeselect}
                onDetectRemaining={handleDetectRemaining}
              />
            </div>

            {/* Resize Handle */}
            <div 
              className="w-1 bg-gray-300 hover:bg-gray-400 cursor-col-resize flex-shrink-0"
              onMouseDown={handleMouseDown}
            />

            {/* Right Panel - Document Selector */}
            <div 
              className="bg-white flex flex-col"
              style={{ width: `${100 - leftPanelWidth}%` }}
            >
              <NewDocumentSelector
                documentFiles={documentFiles}
                selectedDocuments={selectedDocuments}
                onSelectionChange={handleDocumentSelectionChange}
                currentReferences={validSelectedReferences}
                onConfirmMapping={handleConfirmMapping}
                matchedPairs={matchedPairs}
              />
            </div>
          </>
        ) : (
          /* Completed Tab - Show Matched Pairs */
          <div className="flex-1 bg-white">
            <MatchedPairs
              matchedPairs={matchedPairs}
              onRemoveMatch={handleRemoveMatch}
            />
          </div>
        )}
      </div>

      {/* Import Validation Dialog */}
      {importDialog.isOpen && importDialog.validationResult && (
        <ImportValidationDialog
          validationResult={importDialog.validationResult}
          onImport={handleImportConfirm}
          onCancel={handleImportCancel}
          isLoading={importDialog.isProcessing}
        />
      )}
    </div>
  );
}