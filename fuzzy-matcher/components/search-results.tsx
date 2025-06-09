// components/search-results.tsx - Search Results Component

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchResult, FileMatch } from '@/lib/types';

interface SearchResultsProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  currentReference: string | null;
  selectedResult: FileMatch | null;
  selectedReferences: Array<{ item: string; order: number }>;
  selectedFilePaths: Array<{ item: string; order: number }>;
  bulkValidation: {
    canBulkMatch: boolean;
    canSingleMatch: boolean;
    isInBulkMode: boolean;
    selectionValid: boolean;
  };
  onResultSelect: (path: string, score: number) => void;
  onToggleFilePathSelection: (path: string) => void;
  onConfirmMatch: () => void;
  onConfirmBulkMatch: () => void;
  onSkipReference: () => void;
}

export function SearchResults({
  searchTerm,
  onSearchTermChange,
  searchResults,
  isSearching,
  currentReference,
  selectedResult,
  selectedFilePaths,
  selectedReferences,
  bulkValidation,
  onResultSelect,
  onToggleFilePathSelection,
  onConfirmMatch,
  onConfirmBulkMatch,
  onSkipReference,
}: SearchResultsProps) {
  const isShowingAllFiles = !searchTerm.trim();
  
  // Get visual order for numbering
  const getSelectionNumber = (path: string): number | null => {
  const found = selectedFilePaths.find(item => item.item === path);
  return found ? found.order : null;
};

  const handleResultClick = (path: string, score: number) => {
  if (selectedReferences.length === 0) {
    // Single selection mode
    onResultSelect(path, score);
  } else {
    // Bulk selection mode - toggle selection
    onToggleFilePathSelection(path);
  }
};

  const handleCheckboxChange = (path: string, checked: boolean) => {
    onToggleFilePathSelection(path);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full">
      {/* Current Reference Display */}
      {currentReference && (
        <div className="bg-green-50 border-b border-green-200 p-4">
          <h4 className="text-sm font-semibold text-green-700 mb-2">Currently Mapping</h4>
          <div className="text-sm text-gray-700">{currentReference}</div>
        </div>
      )}

      {/* Search Input */}
      <div className="p-4 border-b">
        <Input
          placeholder="Search for matching file paths..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className={`${isSearching ? 'animate-pulse' : ''}`}
        />
      </div>

      {/* Selection Feedback */}
      {bulkValidation.isInBulkMode && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          {selectedReferences.length >= 2 ? (
            <div className="text-sm text-blue-800">
              📋 Bulk Matching Mode: {selectedReferences.length} references selected
              <br />
              {selectedFilePaths.length < selectedReferences.length && (
                <span>Select {selectedReferences.length - selectedFilePaths.length} more file path(s)</span>
              )}
              {selectedFilePaths.length === selectedReferences.length && (
                <span className="text-green-600">✓ Ready to confirm bulk match</span>
              )}
            </div>
          ) : (
            <div className="text-sm text-yellow-800">
              ⚠️ Select at least 2 references to enable bulk matching
            </div>
          )}
        </div>
      )}

      {/* Search Results */}
      <ScrollArea className="flex-1 p-3 min-h-0">
        {searchResults.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {!searchTerm && currentReference ? (
              "No file paths found."
            ) : searchTerm ? (
              <>No results found for "<strong>{searchTerm}</strong>"</>
            ) : (
              "🎉 All file paths have been matched!"
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map((match) => {
              const parts = match.path.split('/');
              const fileName = parts.pop() || '';
              const pathParts = parts.join('/');
              
              const isSelected = selectedFilePaths.some(item => item.item === match.path);
              const isSingleSelected = selectedResult?.path === match.path;
              const selectionNumber = getSelectionNumber(match.path);
              
              const canSelect = selectedReferences.length === 0 || 
                              selectedFilePaths.length < selectedReferences.length || 
                              isSelected;

              return (
                <div
                  key={match.path}
                  className={`
                    bg-gray-50 border rounded-md p-3 cursor-pointer transition-all
                    hover:bg-gray-100 hover:border-emerald-300
                    ${isSelected ? 'bg-emerald-50 border-emerald-300 border-2' : ''}
                    ${isSingleSelected && selectedReferences.length === 0 ? 'bg-blue-50 border-blue-300 border-2' : ''}
                  `}
                  onClick={() => handleResultClick(match.path, match.score)}
                >
                  <div className="flex items-center gap-3">
                    {/* Selection Indicator */}
                    {isSelected && selectionNumber ? (
                      <div className="bg-emerald-700 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">
                        {selectionNumber}
                      </div>
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        disabled={!canSelect}
                        onCheckedChange={(checked) => handleCheckboxChange(match.path, !!checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 font-mono break-all leading-tight">
                            {pathParts}/
                        </div>
                        <div className="text-sm font-medium text-gray-900 break-words leading-tight">
                            {fileName}
                        </div>
                    </div>

                    {/* Score Badge */}
                    {!isShowingAllFiles && (
                      <Badge 
                        variant={match.score > 0.7 ? "default" : match.score > 0.4 ? "secondary" : "outline"}
                        className={`
                          ${match.score > 0.7 ? 'bg-emerald-700' : ''}
                          ${match.score > 0.4 && match.score <= 0.7 ? 'bg-yellow-500' : ''}
                        `}
                      >
                        {(match.score * 100).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Action Buttons */}
      <div className="bg-gray-50 border-t p-4 flex gap-2">
        {selectedReferences.length >= 2 ? (
          <Button 
            onClick={onConfirmBulkMatch}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            ✓ Confirm Bulk Match ({selectedReferences.length})
          </Button>
        ) : (
          <>
            <Button 
              onClick={onConfirmMatch}
              disabled={!bulkValidation.canSingleMatch}
              className="flex-1 bg-emerald-700 hover:bg-emerald-600"
            >
              ✓ Confirm Match
            </Button>
            <Button 
              variant="outline" 
              onClick={onSkipReference}
              disabled={!currentReference}
            >
              ⏭ Skip
            </Button>
          </>
        )}
      </div>
    </div>
  );
}