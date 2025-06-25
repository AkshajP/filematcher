// app/page.tsx - Main Page Component with Worker Integration

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
import { AutoMatchResult, AutoMatchSuggestion } from '@/lib/auto-matcher';
import { MatchedPair } from '@/lib/types';
import { useState, useEffect } from 'react';

type WorkflowMode = 'setup' | 'working';

export default function HomePage() {
  const { 
    matcher,
    searchTerm,
    setSearchTerm,
    searchResults,
    isLoading,
    isSearching,
    isWorkerReady,
    stats,
    bulkValidation,
    handleResultSelect,
    exportMappings,
    generateAutoMatch,
    updateSearchIndex,
    workerStatus,
  } = useMatcherLogic();

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
    progress?: number;
    currentItem?: string;
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
        await updateSearchIndex(filePaths);
        
        setImportDialog({
          isOpen: true,
          validationResult,
          awaitingFolder: false,
          pendingImportData: undefined
        });
      } else {
        matcher.updateFilePathsOnly(filePaths);
        await updateSearchIndex(filePaths);
        
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
  // Validate preconditions
  if (!matcher.unmatchedReferences || matcher.unmatchedReferences.length === 0) {
    alert('No unmapped references found to auto-match.');
    return;
  }

  if (!matcher.filePaths || matcher.filePaths.length === 0) {
    alert('No file paths loaded. Please upload a folder structure first.');
    return;
  }

  if (!isWorkerReady) {
    alert('Search worker is not ready. Please wait for initialization to complete.');
    return;
  }

  try {
    console.log('Starting worker-powered auto-match process...');
    
    setAutoMatchDialog({
      isOpen: true,
      isProcessing: true,
      progress: 0
    });

    const result = await generateAutoMatch((progressData) => {
      // Handle progress updates
      if (progressData && progressData.type === 'AUTO_MATCH_PROGRESS') {
        setAutoMatchDialog(prev => ({
          ...prev,
          progress: progressData.progress || 0,
          currentItem: progressData.currentReference
        }));
      }
    });

    // Enhanced validation with multiple checks
    if (!result || typeof result !== 'object') {
      console.error('Auto-match returned invalid result:', result);
      setAutoMatchDialog({ isOpen: false });
      alert('Auto-match failed to return valid results. Please try again.');
      return;
    }

    if (!Array.isArray(result.suggestions)) {
      console.error('Auto-match returned invalid suggestions:', result.suggestions);
      setAutoMatchDialog({ isOpen: false });
      alert('Auto-match returned invalid suggestions format. Please try again.');
      return;
    }

    // Check if we have any valid suggestions with paths
    const validSuggestions = result.suggestions.filter(s => s && s.suggestedPath && s.suggestedPath.trim() !== '');
    
    if (validSuggestions.length === 0) {
      setAutoMatchDialog({ isOpen: false });
      alert('No suggestions could be generated. Try adjusting your file descriptions or check if files are already matched.');
      return;
    }

    setAutoMatchDialog({
      isOpen: true,
      result,
      isProcessing: false
    });

    console.log(`Generated ${validSuggestions.length}/${result.suggestions.length} valid auto match suggestions`);
  } catch (error) {
    console.error('Failed to generate auto match suggestions:', error);
    setAutoMatchDialog({ isOpen: false });
    
    // More specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    alert(`Failed to generate suggestions: ${errorMessage}. Please try again.`);
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
          <p className="text-gray-600">
            {isWorkerReady ? 'Initializing workers...' : 'Loading file data...'}
          </p>
          {workerStatus.searchWorkerActive && (
            <p className="text-xs text-emerald-600 mt-2">
              ⚡ Worker-powered search active
            </p>
          )}
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
      
      {/* Worker Status Indicator */}
      {workflowMode === 'working' && (
        <div className="bg-blue-50 border-b border-blue-200 px-8 py-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center gap-1 ${workerStatus.searchWorkerActive ? 'text-green-700' : 'text-gray-600'}`}>
                {workerStatus.searchWorkerActive ? '⚡' : '🔄'} 
                Search: {workerStatus.searchWorkerActive ? 'Worker-powered' : 'Main thread'}
              </span>
              <span className={`${isWorkerReady ? 'text-green-700' : 'text-orange-600'}`}>
                Index: {isWorkerReady ? 'Ready' : 'Initializing...'}
              </span>
            </div>
            <div className="text-gray-500">
              Performance mode: {workerStatus.searchWorkerActive ? 'Optimized' : 'Standard'}
            </div>
          </div>
        </div>
      )}
      
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
            
            {/* Middle Panel - Search Results (Worker-powered) */}
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

      {autoMatchDialog.isOpen && (
        <>
          {autoMatchDialog.isProcessing ? (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold mb-2">Generating Auto-Match Suggestions</h3>
                  <p className="text-gray-600 mb-4">Using worker-powered fuzzy matching...</p>
                  {autoMatchDialog.progress !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${autoMatchDialog.progress}%` }}
                      ></div>
                    </div>
                  )}
                  {autoMatchDialog.currentItem && (
                    <p className="text-xs text-gray-500 truncate">
                      Processing: {autoMatchDialog.currentItem}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : autoMatchDialog.result && (
            <AutoMatchDialog
              autoMatchResult={autoMatchDialog.result}
              onAccept={handleAutoMatchAccept}
              onCancel={handleAutoMatchCancel}
              isProcessing={autoMatchDialog.isProcessing}
            />
          )}
        </>
      )}
    </div>
  );
}