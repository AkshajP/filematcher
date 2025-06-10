'use client';

// app/page.tsx - Main Page Component with Full Import Integration

import { Header } from '@/components/header';
import { FileReferences } from '@/components/file-references';
import { SearchResults } from '@/components/search-results';
import { MatchedPairs } from '@/components/matched-pairs';
import { StatusBar } from '@/components/status-bar';
import { ImportValidationDialog } from '@/components/import-validation-dialog';
import { useMatcherLogic } from '@/hooks/use-matcher';
import { loadFromFolder, loadFromFiles } from '@/lib/data-loader';
import { importReferencesFromFile, downloadReferenceTemplate } from '@/lib/reference-loader';
import { parseExportedCSV, validateImportedMappings, applyImportedMappings, ImportValidationResult, ImportOptions } from '@/lib/import-manager';
import { useState } from 'react';

export default function HomePage() {
  const { 
    matcher,
    searchTerm,
    setSearchTerm,
    searchResults,
    isLoading,
    isSearching,
    stats,
    bulkValidation,
    handleResultSelect,
    exportMappings,
    loadFallbackData
  } = useMatcherLogic();

  // Import state management
  const [importDialog, setImportDialog] = useState<{
    isOpen: boolean;
    validationResult?: ImportValidationResult;
    awaitingFolder?: boolean;
    pendingImportData?: any;
    isProcessing?: boolean;
  }>({ isOpen: false });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading file data...</p>
        </div>
      </div>
    );
  }

  const handleImportFiles = async (files: FileList) => {
    try {
      const data = await loadFromFiles(files);
      matcher.initializeData(data.fileReferences, data.filePaths, data.folderName);
      console.log(`Imported ${data.fileReferences.length} references and ${data.filePaths.length} file paths`);
    } catch (error) {
      console.error('Failed to import files:', error);
      alert('Failed to import files. Please try again.');
    }
  };

  const handleImportFolder = async (files: FileList) => {
    try {
      const result = await loadFromFolder(files);
      
      // Add safety check
      if (!result || !result.filePaths) {
        throw new Error('Invalid folder data returned');
      }
      
      const { filePaths, folderName } = result;
      
      // Check if we have pending import data waiting for folder
      if (importDialog.awaitingFolder && importDialog.pendingImportData) {
        const { metadata, mappings } = importDialog.pendingImportData;
        
        // Validate the imported mappings against this folder
        const validationResult = validateImportedMappings(mappings, filePaths, metadata);
        
        // Update file paths first
        matcher.updateFilePathsOnly(filePaths);
        
        // Show validation dialog
        setImportDialog({
          isOpen: true,
          validationResult,
          awaitingFolder: false,
          pendingImportData: undefined
        });
      } else {
        // Normal folder import
        matcher.updateFilePathsOnly(filePaths);
        
        // Update the folder name in context if we have references
        const currentReferences = matcher.fileReferences || [];
        if (currentReferences.length > 0) {
          matcher.initializeData(currentReferences, filePaths, folderName);
        }
      }
      
      console.log(`Imported ${filePaths.length} file paths from folder: ${folderName}`);
    } catch (error) {
      console.error('Failed to import folder:', error);
      alert('Failed to import folder. Please try again.');
    }
  };

  const handleImportReferences = async (files: FileList) => {
  try {
    const file = files[0];
    const result = await importReferencesFromFile(file);
    
    // Update the matcher with new references, keeping existing file paths and folder name
    const currentFilePaths = matcher.filePaths || [];
    const currentFolderName = matcher.folderName || '';
    
    matcher.initializeData(result.references, currentFilePaths, currentFolderName);
    
    console.log(`Imported ${result.references.length} references from ${result.fileName}`);
  } catch (error) {
    console.error('Failed to import references:', error);
    alert(`Failed to import references: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

  const handleImportMappings = async (files: FileList) => {
    try {
      const file = files[0];
      const { metadata, mappings, errors } = await parseExportedCSV(file);
      
      if (errors.length > 0) {
        console.warn('CSV parsing errors:', errors);
        // Show errors but continue if we have some valid data
        if (mappings.length === 0) {
          alert(`Failed to parse mappings file:\n${errors.join('\n')}`);
          return;
        }
      }

      if (mappings.length === 0) {
        alert('No valid mappings found in the file.');
        return;
      }

      // If we have file paths already, validate immediately
      if (matcher.filePaths.length > 0) {
        const validationResult = validateImportedMappings(mappings, matcher.filePaths, metadata);
        setImportDialog({
          isOpen: true,
          validationResult
        });
      } else {
        // Need to prompt for folder selection first
        const folderName = metadata?.folderName || 'unknown folder';
        alert(`To import mappings from "${folderName}", please first upload the corresponding folder structure using "Import Folder".`);
        setImportDialog({
          isOpen: false,
          awaitingFolder: true,
          pendingImportData: { metadata, mappings }
        });
      }
    } catch (error) {
      console.error('Failed to import mappings:', error);
      alert(`Failed to import mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImportConfirm = async (options: ImportOptions) => {
    if (!importDialog.validationResult) return;

    try {
      setImportDialog(prev => ({ ...prev, isProcessing: true }));

      const { mappingsToImport, referencesToCreate, usedFilePaths } = applyImportedMappings(
        importDialog.validationResult.mappings,
        matcher.filePaths,
        options,
        importDialog.validationResult
      );

      // Debug logging
      console.log('Mappings to import:', mappingsToImport);
      console.log('Current matched pairs before import:', matcher.matchedPairs);

      // Apply the import
      matcher.importMappings(
        mappingsToImport,
        referencesToCreate,
        usedFilePaths,
        importDialog.validationResult.metadata?.folderName
      );

      // Debug logging after import
      setTimeout(() => {
        console.log('Current matched pairs after import:', matcher.matchedPairs);
      }, 100);

      console.log(`Imported ${mappingsToImport.length} mappings and created ${referencesToCreate.length} new references`);
      
      setImportDialog({ isOpen: false });
      
      // Show success message
      const totalImported = mappingsToImport.length + referencesToCreate.length;
      if (totalImported > 0) {
        alert(`Successfully imported ${mappingsToImport.length} mappings and created ${referencesToCreate.length} new references.`);
      }
    } catch (error) {
      console.error('Failed to apply import:', error);
      alert(`Failed to apply import: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setImportDialog(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleImportCancel = () => {
    setImportDialog({ isOpen: false });
  };

  const handleDownloadTemplate = () => {
    try {
      downloadReferenceTemplate();
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <Header 
        onExport={exportMappings} 
        onImportFiles={handleImportFiles}
        onImportFolder={handleImportFolder}
        onImportReferences={handleImportReferences}
        onImportMappings={handleImportMappings}
        onDownloadTemplate={handleDownloadTemplate}
        onLoadFallbackData={loadFallbackData}
      />
      
      {/* Pending Import Indicator */}
      {importDialog.awaitingFolder && (
        <div className="bg-blue-50 border-b border-blue-200 px-8 py-3">
          <div className="text-blue-800 text-sm">
            📁 <strong>Waiting for folder:</strong> Please upload the folder structure to validate mappings from "{importDialog.pendingImportData?.metadata?.folderName || 'unknown'}"
          </div>
        </div>
      )}
      
      {/* Main Content - Three Panel Layout */}
      <main className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden min-h-0">
        {/* Left Panel - File References */}
        <FileReferences 
          references={matcher.unmatchedReferences}
          selectedReferences={matcher.selectedReferences}
          currentReference={matcher.currentReference}
          originalCount={matcher.originalReferencesCount}
          onSelectReference={matcher.selectReference}
          onToggleSelection={matcher.toggleReferenceSelection}
          onSelectAll={matcher.selectAllReferences}
          onBulkSkip={matcher.bulkSkipReferences}
          onBulkDeselect={matcher.bulkDeselectAll}
          onDetectRemaining={matcher.detectRemainingFiles}
        />
        
        {/* Middle Panel - Search Results */}
        <SearchResults 
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          searchResults={searchResults}
          isSearching={isSearching}
          currentReference={matcher.currentReference}
          selectedResult={matcher.selectedResult}
          selectedFilePaths={matcher.selectedFilePaths}
          selectedReferences={matcher.selectedReferences}
          bulkValidation={bulkValidation}
          onResultSelect={handleResultSelect}
          onToggleFilePathSelection={matcher.toggleFilePathSelection}
          onConfirmMatch={matcher.confirmMatch}
          onConfirmBulkMatch={matcher.confirmBulkMatch}
          onSkipReference={matcher.skipReference}
        />
        
        {/* Right Panel - Matched Pairs */}
        <MatchedPairs 
          matchedPairs={matcher.matchedPairs}
          onRemoveMatch={matcher.removeMatch}
        />
      </main>
      
      {/* Footer Status Bar */}
      <StatusBar stats={stats} />

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