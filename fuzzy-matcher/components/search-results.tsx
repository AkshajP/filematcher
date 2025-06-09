// components/search-results.tsx - Search Results Component with Keyboard Navigation

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchResult, FileMatch } from "@/lib/types";
import { useState, useEffect, useRef, useCallback } from "react";

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
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isShowingAllFiles = !searchTerm.trim();

  // Get visual order for numbering
  const getSelectionNumber = (path: string): number | null => {
    const found = selectedFilePaths.find((item) => item.item === path);
    return found ? found.order : null;
  };

  // Scroll focused item into view
  const scrollIntoView = useCallback((index: number) => {
    if (itemRefs.current[index]) {
      itemRefs.current[index]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, []);

  // Handle range selection
  const handleRangeSelection = useCallback(
    (startIndex: number, endIndex: number) => {
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      for (let i = start; i <= end; i++) {
        if (i >= 0 && i < searchResults.length) {
          const result = searchResults[i];
          const isCurrentlySelected = selectedFilePaths.some(
            (item) => item.item === result.path
          );
          const canSelect =
            selectedReferences.length === 0 ||
            selectedFilePaths.length < selectedReferences.length ||
            isCurrentlySelected;

          // Only toggle if not already in desired state and can select
          if (!isCurrentlySelected && canSelect) {
            onToggleFilePathSelection(result.path);
          }
        }
      }
    },
    [
      searchResults,
      selectedFilePaths,
      selectedReferences.length,
      onToggleFilePathSelection,
    ]
  );

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with search input
      if (searchInputRef.current?.contains(document.activeElement as Node)) {
        return;
      }

      if (!containerRef.current?.contains(document.activeElement)) return;

      const isShiftPressed = e.shiftKey;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex = Math.min(
            focusedIndex + 1,
            searchResults.length - 1
          );
          setFocusedIndex(nextIndex);
          scrollIntoView(nextIndex);

          if (isShiftPressed && lastSelectedIndex !== -1) {
            handleRangeSelection(lastSelectedIndex, nextIndex);
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          const prevIndex = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prevIndex);
          scrollIntoView(prevIndex);

          if (isShiftPressed && lastSelectedIndex !== -1) {
            handleRangeSelection(lastSelectedIndex, prevIndex);
          }
          break;

        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < searchResults.length) {
            const result = searchResults[focusedIndex];
            onToggleFilePathSelection(result.path);
            setLastSelectedIndex(focusedIndex);
          }
          break;

        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < searchResults.length) {
            const result = searchResults[focusedIndex];
            if (selectedReferences.length === 0) {
              onResultSelect(result.path, result.score);
            } else {
              onToggleFilePathSelection(result.path);
              setLastSelectedIndex(focusedIndex);
            }
          }
          break;

        case "Escape":
          e.preventDefault();
          // Clear selections or focus search input
          if (selectedFilePaths.length > 0) {
            selectedFilePaths.forEach((item) =>
              onToggleFilePathSelection(item.item)
            );
          } else {
            searchInputRef.current?.focus();
          }
          setLastSelectedIndex(-1);
          break;

        case "/":
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    focusedIndex,
    lastSelectedIndex,
    searchResults,
    selectedFilePaths,
    selectedReferences.length,
    handleRangeSelection,
    onToggleFilePathSelection,
    onResultSelect,
  ]);

  // Reset focus when search results change
  useEffect(() => {
    if (searchResults.length > 0 && focusedIndex >= searchResults.length) {
      setFocusedIndex(0);
    } else if (searchResults.length > 0 && focusedIndex === -1) {
      setFocusedIndex(0);
    }
  }, [searchResults.length, focusedIndex]);

  const handleResultClick = (path: string, score: number, index: number) => {
    setFocusedIndex(index);
    setLastSelectedIndex(index);

    if (selectedReferences.length === 0) {
      // Single selection mode
      onResultSelect(path, score);
    } else {
      // Bulk selection mode - toggle selection
      onToggleFilePathSelection(path);
    }
  };

  const handleCheckboxChange = (
    path: string,
    checked: boolean,
    index: number
  ) => {
    setFocusedIndex(index);
    setLastSelectedIndex(index);
    onToggleFilePathSelection(path);
  };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full"
      tabIndex={0}
    >
      {/* Current Reference Display */}
      {(currentReference || selectedReferences.length > 0) && (
        <div className="bg-green-50 border-b border-green-200 p-4">
          <h4 className="text-sm font-semibold text-green-700 mb-2">
            Currently Mapping
          </h4>
          {selectedReferences.length > 0 ? (
            (() => {
              // Find the next reference that needs a file path
              const refOrders = new Set(selectedReferences.map((r) => r.order));
              const pathOrders = new Set(selectedFilePaths.map((p) => p.order));

              // Find the lowest order number that has a reference but no file path
              let nextOrder = null;
              for (let i = 1; i <= selectedReferences.length; i++) {
                if (refOrders.has(i) && !pathOrders.has(i)) {
                  nextOrder = i;
                  break;
                }
              }

              if (nextOrder) {
                const nextRef = selectedReferences.find(
                  (r) => r.order === nextOrder
                );
                return (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="bg-emerald-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                      {nextOrder}
                    </div>
                    <span>{nextRef?.item}</span>
                  </div>
                );
              } else {
                return (
                  <div className="text-sm text-green-600">
                    ✓ All positions mapped
                  </div>
                );
              }
            })()
          ) : (
            <div className="text-sm text-gray-700">{currentReference}</div>
          )}
        </div>
      )}

      {/* Search Input */}
      <div className="p-4 border-b">
        <Input
          ref={searchInputRef}
          placeholder="Search for matching file paths... (Press / to focus)"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className={`${isSearching ? "animate-pulse" : ""}`}
        />
      </div>

      {/* Keyboard Shortcuts Help */}
      {bulkValidation.isInBulkMode && (
        <div className="bg-blue-50 border-b px-3 py-2 text-xs text-blue-700">
          💡 Use ↑↓ arrows to navigate, Shift+↑↓ for range selection, Space to
          toggle, Enter to select, / to search
        </div>
      )}

      {/* Selection Feedback */}
      {bulkValidation.isInBulkMode && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          {selectedReferences.length >= 2 ? (
            <div className="text-sm text-blue-800">
              📋 Bulk Matching Mode: {selectedReferences.length} references
              selected
              <br />
              {selectedFilePaths.length < selectedReferences.length && (
                <span>
                  Select {selectedReferences.length - selectedFilePaths.length}{" "}
                  more file path(s)
                </span>
              )}
              {selectedFilePaths.length === selectedReferences.length && (
                <span className="text-green-600">
                  ✓ Ready to confirm bulk match
                </span>
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
              <>
                No results found for "<strong>{searchTerm}</strong>"
              </>
            ) : (
              "🎉 All file paths have been matched!"
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map((match, index) => {
              const parts = match.path.split("/");
              const fileName = parts.pop() || "";
              const pathParts = parts.join("/");

              const isSelected = selectedFilePaths.some(
                (item) => item.item === match.path
              );
              const isSingleSelected = selectedResult?.path === match.path;
              const selectionNumber = getSelectionNumber(match.path);
              const isFocused = index === focusedIndex;

              const canSelect =
                selectedReferences.length === 0 ||
                selectedFilePaths.length < selectedReferences.length ||
                isSelected;

              return (
                <div
                  key={match.path}
                  ref={(el) => (itemRefs.current[index] = el)}
                  className={`
                    bg-gray-50 border rounded-md p-3 cursor-pointer transition-all
                    hover:bg-gray-100 hover:border-emerald-300
                    ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-300 border-2"
                        : ""
                    }
                    ${
                      isSingleSelected && selectedReferences.length === 0
                        ? "bg-blue-50 border-blue-300 border-2"
                        : ""
                    }
                    ${isFocused ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                  `}
                  onClick={() =>
                    handleResultClick(match.path, match.score, index)
                  }
                >
                  <div className="flex items-center gap-3">
                    {/* Selection Indicator */}
                    {isSelected && selectionNumber ? (
                      <div className="bg-emerald-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                        {selectionNumber}
                      </div>
                    ) : (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          disabled={!canSelect}
                          onCheckedChange={(checked) =>
                            handleCheckboxChange(match.path, !!checked)
                          }
                        />
                      </div>
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
                        variant={
                          match.score > 0.7
                            ? "default"
                            : match.score > 0.4
                            ? "secondary"
                            : "outline"
                        }
                        className={`
                          ${match.score > 0.7 ? "bg-emerald-700" : ""}
                          ${
                            match.score > 0.4 && match.score <= 0.7
                              ? "bg-yellow-500"
                              : ""
                          }
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
            disabled={!bulkValidation.canBulkMatch}
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
