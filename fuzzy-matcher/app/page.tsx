// app/page.tsx - Main Page Component with Workflow Integration

'use client';

import { WorkflowHeader } from '@/components/workflow-header';
import { FileReferences } from '@/components/file-references';
import { SearchResults } from '@/components/search-results';
import { MatchedPairs } from '@/components/matched-pairs';
import { StatusBar } from '@/components/status-bar';
import { ImportValidationDialog } from '@/components/import-validation-dialog';
import { AutoMatchDialog } from '@/components/auto-match-dialog';
import { useMatcherLogic } from '@/hooks/use-matcher';
import { loadFromFolder } from '@/lib/data-loader';
import { importReferencesFromFile, downloadReferenceTemplate } from '@/lib/reference-loader';
import { parseExportedCSV, validateImportedMappings, applyImportedMappings, ImportValidationResult, ImportOptions, validateImportedMappingsAgainstCurrentState } from '@/lib/import-manager';
import { generateAutoMatchSuggestions, AutoMatchResult, AutoMatchSuggestion } from '@/lib/auto-matcher';
import { SearchIndex } from '@/lib/fuzzy-matcher'; // New Import
import { MatchedPair } from '@/lib/types';
import { useState, useEffect, useMemo } from 'react'; // New Import: useMemo

type WorkflowMode = 'setup' | 'working';

export default function HomePage() {
  const { 
    matcher,
    searchTerm,
    setSearchTerm,
    searchResults: initialSearchResults, // Keep initial results for reference if needed
    isLoading,
    isSearching,
    stats,
    bulkValidation,
    handleResultSelect,
    exportMappings,
  } = useMatcherLogic();

  // 1. Create the search index only when file paths change
  const searchIndex = useMemo(() => {
    if (matcher.filePaths.length > 0) {
      return new SearchIndex(matcher.filePaths);
    }
    return null;
  }, [matcher.filePaths]);

  // 2. Manage search results locally using the new index
  const [searchResults, setSearchResults] = useState(initialSearchResults);

  // Effect to run search whenever the term or index changes
  useEffect(() => {
    if (searchIndex) {
      // isSearching is still useful for debouncing visual feedback
      const results = searchIndex.search(searchTerm, matcher.usedFilePaths);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, searchIndex, matcher.usedFilePaths]);


  // Workflow state management
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('setup');

  // Import state management
  const [importDialog, setImportDialog] = useState<{
    isOpen: boolean;
    validationResult?: ImportValidationResult;
    awaitingFolder?: boolean;
    pendingImportData?: unknown;
    isProcessing?: boolean;
  }>({ isOpen: false });

  // Auto match state management
  const [autoMatchDialog, setAutoMatchDialog] = useState<{
    isOpen: boolean;
    result?: AutoMatchResult;
    isProcessing?: boolean;
  }>({ isOpen: false });

  // Determine current workflow state
  const indexStatus = {
    loaded: matcher.fileReferences.length > 0,
    count: matcher.fileReferences.length,
    fileName: 'Client Index'
  };

  const folderStatus = {
    loaded: matcher.filePaths.length > 0,
    count: matcher.filePaths.length,
    folderName: matcher.folderName || 'Project Folder'
  };

  const bothLoaded = indexStatus.loaded && folderStatus.loaded;

  // Auto-transition to working mode when both are loaded
  useEffect(() => {
    if (bothLoaded && workflowMode === 'setup') {
      setWorkflowMode('working');
    }
  }, [bothLoaded, workflowMode]);


  const handleImportFolder = async (files: FileList) => {
    try {
      const result = await loadFromFolder(files);
      
      if (!result || !result.filePaths) {
        throw new Error('Invalid folder data returned');
      }
      
      const { filePaths, folderName } = result;
      
      if (importDialog.awaitingFolder && importDialog.pendingImportData) {
        const { metadata, mappings } = importDialog.pendingImportData;
        
        const validationResult = validateImportedMappings(mappings, filePaths, metadata);
        
        matcher.updateFilePathsOnly(filePaths);
        
        setImportDialog({
          isOpen: true,
          validationResult,
          awaitingFolder: false,
          pendingImportData: undefined
        });
      } else {
        matcher.updateFilePathsOnly(filePaths);
        
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
        if (mappings.length === 0) {
          alert(`Failed to parse mappings file:\n${errors.join('\n')}`);
          return;
        }
      }

      if (mappings.length === 0) {
        alert('No valid mappings found in the file.');
        return;
      }

      if (matcher.filePaths.length === 0 || matcher.fileReferences.length === 0) {
        alert('Please first upload both:\n1. Your new client index (Import References)\n2. Your new folder structure (Import Folder)\n\nThen try importing mappings again.');
        return;
      }

      const validationResult = validateImportedMappingsAgainstCurrentState(
        mappings, 
        matcher.fileReferences, 
        matcher.filePaths, 
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

      const { mappingsToImport, referencesToRestore, usedFilePaths } = applyImportedMappings(
        importDialog.validationResult.mappings,
        matcher.filePaths,
        options,
        importDialog.validationResult
      );

      matcher.importMappings(
        mappingsToImport,
        referencesToRestore,
        usedFilePaths,
        importDialog.validationResult.metadata?.folderName
      );

      console.log(`Imported ${mappingsToImport.length} mappings and restored ${referencesToRestore.length} missing references`);
      
      setImportDialog({ isOpen: false });
      
      let message = `Successfully imported ${mappingsToImport.length} mappings`;
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

  const handleStartAutoMatch = async () => {
    if (matcher.unmatchedReferences.length === 0) {
      alert('No unmapped references found to auto-match.');
      return;
    }

    if (matcher.filePaths.length === 0) {
      alert('No file paths loaded. Please upload a folder structure first.');
      return;
    }

    try {
      console.log('Starting auto-match process...');
      const result = generateAutoMatchSuggestions(
        matcher.unmatchedReferences,
        matcher.filePaths,
        matcher.usedFilePaths
      );

      if (result.suggestions.filter(s => s.suggestedPath).length === 0) {
        alert('No suggestions could be generated. Try adjusting your file descriptions or check if files are already matched.');
        return;
      }

      setAutoMatchDialog({
        isOpen: true,
        result
      });

      console.log(`Generated ${result.suggestions.length} auto match suggestions`);
    } catch (error) {
      console.error('Failed to generate auto match suggestions:', error);
      alert('Failed to generate suggestions. Please try again.');
    }
  };

  const handleAutoMatchAccept = async (acceptedSuggestions: AutoMatchSuggestion[]) => {
    if (acceptedSuggestions.length === 0) {
      setAutoMatchDialog({ isOpen: false });
      return;
    }

    try {
      setAutoMatchDialog(prev => ({ ...prev, isProcessing: true }));

      const newMatchedPairs: MatchedPair[] = acceptedSuggestions.map(suggestion => ({
        reference: suggestion.reference.description,
        path: suggestion.suggestedPath,
        score: suggestion.score,
        timestamp: new Date().toISOString(),
        method: 'auto' as const,
        sessionId: matcher.sessionId,
        originalDate: suggestion.reference.date,
        originalReference: suggestion.reference.reference,
      }));

      const usedPaths = new Set(newMatchedPairs.map(pair => pair.path));
      
      matcher.importMappings(
        newMatchedPairs,
        [], 
        usedPaths,
        matcher.folderName
      );
      
      setAutoMatchDialog({ isOpen: false });
      
      alert(`Successfully applied ${acceptedSuggestions.length} auto-matched mapping${acceptedSuggestions.length !== 1 ? 's' : ''}.`);
    } catch (error) {
      console.error('Failed to apply auto match results:', error);
      alert(`Failed to apply auto match results: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAutoMatchDialog(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleAutoMatchCancel = () => {
    setAutoMatchDialog({ isOpen: false });
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
        onExport={exportMappings}
        mappingProgress={{
          completed: matcher.matchedPairs.length,
          total: matcher.fileReferences.length
        }}
        unmappedCount={matcher.unmatchedReferences.length}
      />
      
      {importDialog.awaitingFolder && (
        <div className="bg-blue-50 border-b border-blue-200 px-8 py-3">
          <div className="text-blue-800 text-sm">
            📁 <strong>Waiting for folder:</strong> Please upload the folder structure to validate mappings from &quot;{importDialog.pendingImportData?.metadata?.folderName || 'unknown'}&quot;
          </div>
        </div>
      )}
      
      {workflowMode === 'working' && (
        <>
          <main className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden min-h-0">
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
            
            {/* Middle Panel - Search Results (Now uses index-based results) */}
            <SearchResults 
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm} // This triggers the useEffect search
              searchResults={searchResults} // Passed from local state
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
            
            <MatchedPairs 
              matchedPairs={matcher.matchedPairs}
              onRemoveMatch={matcher.removeMatch}
            />
          </main>
          
          <StatusBar stats={stats} />
        </>
      )}

      {importDialog.isOpen && importDialog.validationResult && (
        <ImportValidationDialog
          validationResult={importDialog.validationResult}
          onImport={handleImportConfirm}
          onCancel={handleImportCancel}
          isLoading={importDialog.isProcessing}
        />
      )}

      {autoMatchDialog.isOpen && autoMatchDialog.result && (
        <AutoMatchDialog
          autoMatchResult={autoMatchDialog.result}
          onAccept={handleAutoMatchAccept}
          onCancel={handleAutoMatchCancel}
          isProcessing={autoMatchDialog.isProcessing}
        />
      )}
    </div>
  );
}