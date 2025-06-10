'use client';

// app/page.tsx - Main Page Component

import { Header } from '@/components/header';
import { FileReferences } from '@/components/file-references';
import { SearchResults } from '@/components/search-results';
import { MatchedPairs } from '@/components/matched-pairs';
import { StatusBar } from '@/components/status-bar';
import { useMatcherLogic } from '@/hooks/use-matcher';
import { loadFromFolder } from '@/lib/data-loader';

export default function HomePage() {
  const { 
    matcher,
    searchTerm,
    setSearchTerm,
    searchResults,
    isLoading,
    isSearching,
    isProcessingFolder,
    stats,
    bulkValidation,
    handleResultSelect,
    exportMappings,
    handleFolderUpload,
    loadFallbackData
  } = useMatcherLogic();

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
    matcher.initializeData(data.fileReferences, data.filePaths);
    console.log(`Imported ${data.fileReferences.length} references and ${data.filePaths.length} file paths`);
  } catch (error) {
    console.error('Failed to import files:', error);
  }
};

const handleImportFolder = async (files: FileList) => {
  try {
    const filePaths = await loadFromFolder(files);
    matcher.updateFilePathsOnly(filePaths);
    console.log(`Imported ${filePaths.length} file paths from folder (references unchanged)`);
  } catch (error) {
    console.error('Failed to import folder:', error);
  }
};

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <Header 
  onExport={exportMappings} 
  // onImportFiles={handleImportFiles}
  onImportFolder={handleImportFolder}
  onLoadFallbackData={loadFallbackData}
/>
      
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
    </div>
  );
}