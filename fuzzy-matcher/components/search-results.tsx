// fuzzy-matcher/components/search-results.tsx - Fixed Shift+Arrow Range Selection

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchResult, FileMatch, FileReference } from "@/lib/types";
import { useEffect, useState, useRef, useCallback } from "react";

interface SearchResultsProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  currentReference: FileReference | null;
  selectedResult: FileMatch | null;
  selectedReferences: Array<{ item: FileReference; order: number }>;
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

  // Multi-select functionality
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [rangeAnchor, setRangeAnchor] = useState<number>(-1);
  // const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  // // Update multi-select mode based on selections
  // useEffect(() => {
  //   setIsMultiSelectMode(
  //     selectedFilePaths.length > 0 || selectedReferences.length > 0
  //   );
  // }, [selectedFilePaths.length, selectedReferences.length]);

  // Reset cursor when search results change
  useEffect(() => {
    setCursorIndex(0);
    setRangeAnchor(-1);
  }, [searchResults]);

  // Auto-scroll functionality
  const scrollToItem = useCallback((index: number) => {
    const itemElement = itemRefs.current[index];
    if (itemElement) {
      itemElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, []);

  // Auto-scroll when cursor moves
  useEffect(() => {
    if (cursorIndex >= 0 && cursorIndex < searchResults.length) {
      const timeoutId = setTimeout(() => {
        scrollToItem(cursorIndex);
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [cursorIndex, scrollToItem, searchResults.length]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Check if '/' is pressed and we're not already in an input/textarea
      if (
        event.key === "/" &&
        event.target instanceof Element &&
        !["INPUT", "TEXTAREA"].includes(event.target.tagName) &&
        !event.target.isContentEditable
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select(); // Optional: select all text for easy replacement
      }
    };

    // Add to document level to catch it globally
    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // Get visual order for numbering
  const getSelectionNumber = (path: string): number | null => {
    const found = selectedFilePaths.find((item) => item.item === path);
    return found ? found.order : null;
  };

  const isSelected = (path: string): boolean => {
    return selectedFilePaths.some((item) => item.item === path);
  };

  // Handle mouse clicks
  const handleResultClick = (
    path: string,
    score: number,
    index: number,
    event: React.MouseEvent
  ) => {
    // Prevent text selection when using Shift
    if (event.shiftKey) {
      event.preventDefault();
    }

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle individual selection & enter multi-select mode
      onToggleFilePathSelection(path);
      setCursorIndex(index);
      setRangeAnchor(index);
    } else if (event.shiftKey && rangeAnchor !== -1) {
      // Shift+Click: Range selection
      event.preventDefault();
      handleRangeSelection(rangeAnchor, index);
      setCursorIndex(index);
    } else {
      // Regular click behavior
      if (selectedReferences.length === 0) {
        // Single selection mode
        onResultSelect(path, score);
      } else {
        // Bulk selection mode - toggle selection
        onToggleFilePathSelection(path);
      }
      setCursorIndex(index);
      setRangeAnchor(index);
    }
  };

  // Fixed range selection that properly handles ranges
  const handleRangeSelection = (startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    // First, get all paths that should be selected in this range
    const pathsInRange = new Set<string>();
    for (let i = start; i <= end; i++) {
      const match = searchResults[i];
      if (match) {
        pathsInRange.add(match.path);
      }
    }

    // Find currently selected paths that are NOT in the range
    const currentlySelected = new Set(selectedFilePaths.map(item => item.item));
    const pathsToDeselect = new Set<string>();
    
    currentlySelected.forEach(path => {
      if (!pathsInRange.has(path)) {
        pathsToDeselect.add(path);
      }
    });

    // Deselect paths outside the range
    pathsToDeselect.forEach(path => {
      if (isSelected(path)) {
        onToggleFilePathSelection(path);
      }
    });

    // Select all paths in the range that aren't already selected
    pathsInRange.forEach(path => {
      if (!isSelected(path)) {
        onToggleFilePathSelection(path);
      }
    });
  };

  // Fixed keyboard navigation with proper range selection
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!containerRef.current || searchResults.length === 0) return;

    let handled = false;

    switch (event.key) {
      case "ArrowDown":
        if (event.shiftKey) {
          // Shift+Down: Range selection downward
          event.preventDefault();
          if (cursorIndex < searchResults.length - 1) {
            const newCursorIndex = cursorIndex + 1;
            
            // If no anchor set, start range selection
            if (rangeAnchor === -1) {
              setRangeAnchor(cursorIndex);
            }
            
            // Perform range selection from anchor to new cursor position
            handleRangeSelection(rangeAnchor, newCursorIndex);
            setCursorIndex(newCursorIndex);
          }
        } else {
          // Down: Move cursor
          event.preventDefault();
          if (cursorIndex < searchResults.length - 1) {
            setCursorIndex(cursorIndex + 1);
            // Reset anchor when not using shift
            setRangeAnchor(-1);
          }
        }
        handled = true;
        break;

      case "ArrowUp":
        if (event.shiftKey) {
          // Shift+Up: Range selection upward
          event.preventDefault();
          if (cursorIndex > 0) {
            const newCursorIndex = cursorIndex - 1;
            
            // If no anchor set, start range selection
            if (rangeAnchor === -1) {
              setRangeAnchor(cursorIndex);
            }
            
            // Perform range selection from anchor to new cursor position
            handleRangeSelection(rangeAnchor, newCursorIndex);
            setCursorIndex(newCursorIndex);
          }
        } else {
          // Up: Move cursor
          event.preventDefault();
          if (cursorIndex > 0) {
            setCursorIndex(cursorIndex - 1);
            // Reset anchor when not using shift
            setRangeAnchor(-1);
          }
        }
        handled = true;
        break;

      case " ":
        // Space: Toggle selection at cursor
        event.preventDefault();
        const match = searchResults[cursorIndex];
        if (match) {
          onToggleFilePathSelection(match.path);
          setRangeAnchor(cursorIndex);
        }
        handled = true;
        break;

      case "Escape":
        // Escape: Clear selections (handled by parent component)
        event.preventDefault();
        // Reset local state
        setRangeAnchor(-1);
        handled = true;
        break;

      case "Enter":
        // Enter: Confirm selection
        if (selectedReferences.length >= 2) {
          event.preventDefault();
          onConfirmBulkMatch();
        } else if (selectedResult) {
          event.preventDefault();
          onConfirmMatch();
        }
        handled = true;
        break;
    }

    if (handled) {
      event.stopPropagation();
    }
  };

  // Keyboard event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [
    cursorIndex,
    rangeAnchor,
    searchResults,
    selectedFilePaths,
    selectedResult,
    selectedReferences,
  ]);

  const handleCheckboxChange = (path: string) => {
    onToggleFilePathSelection(path);
  };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
      tabIndex={0}
    >
      {/* Current Reference Display */}
      {(currentReference || selectedReferences.length > 0) && (
        <div className="bg-green-50 border-b border-green-200 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-green-700">
              Currently Mapping
            </h4>

            {/* Progress badge */}
            {selectedReferences.length >= 2 && (
              <Badge
                variant="outline"
                className={`text-xs px-2 py-1 font-medium ${
                  selectedFilePaths.length === selectedReferences.length
                    ? "border-green-600 text-green-700 bg-green-50"
                    : "border-red-500 text-red-600 bg-red-50"
                }`}
              >
                {selectedFilePaths.length}/{selectedReferences.length}
              </Badge>
            )}
          </div>

          {selectedReferences.length > 0 ? (
            (() => {
              const refOrders = new Set(selectedReferences.map((r) => r.order));
              const pathOrders = new Set(selectedFilePaths.map((p) => p.order));

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
                  <div className="flex items-center gap-2 text-sm text-gray-700 mt-1">
                    <div className="bg-emerald-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                      {nextOrder}
                    </div>
                    <span>{nextRef?.item.description}</span>
                  </div>
                );
              } else {
                return (
                  <div className="text-sm text-green-600 mt-1">
                    ✓ All positions mapped
                  </div>
                );
              }
            })()
          ) : (
            <div className="text-sm text-gray-700 mt-1">{currentReference?.description}</div>
          )}
        </div>
      )}

      {/* Search Input */}
      <div className="p-4 border-b">
        <Input
          ref={searchInputRef}
          placeholder="Search for matching file paths..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className={`${isSearching ? "animate-pulse" : ""}`}
        />
      </div>

    

       {/* Search Results */}
      <ScrollArea className="flex-1 p-3 min-h-0">
        {searchResults.length === 0 ? (
  <div className="text-center text-gray-500 py-8">
    {!searchTerm && !currentReference ? (
      <>
        📁 No file paths loaded
        <div className="text-xs mt-2 text-gray-400">
          Upload a folder to load file paths
        </div>
      </>
    ) : searchTerm ? (
      <>
        No results found for &quot;<strong>{searchTerm}</strong>&quot;
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

              const isItemSelected = isSelected(match.path);
              const isSingleSelected = selectedResult?.path === match.path;
              const isCursor = index === cursorIndex;
              const selectionNumber = getSelectionNumber(match.path);

              const canSelect =
                selectedReferences.length === 0 ||
                selectedFilePaths.length < selectedReferences.length ||
                isItemSelected;

              return (
                <div
                  key={match.path}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={`
                    bg-gray-50 border rounded-md p-3 cursor-pointer transition-all relative
                    hover:bg-gray-100 hover:border-emerald-300
                    ${
                      isItemSelected
                        ? "bg-emerald-50 border-emerald-300 border-2"
                        : ""
                    }
                    ${
                      isSingleSelected && selectedReferences.length === 0
                        ? "bg-blue-50 border-blue-300 border-2"
                        : ""
                    }
                    ${isCursor ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                  `}
                  onClick={(e) =>
                    handleResultClick(match.path, match.score, index, e)
                  }
                  onMouseDown={(e) => {
                    // Prevent text selection on shift+click
                    if (e.shiftKey) {
                      e.preventDefault();
                    }
                  }}
                >
                  {/* Cursor indicator */}
                  {isCursor && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-md"></div>
                  )}

                  <div className="flex items-center gap-3">
                    {/* Selection Indicator */}
                    {isItemSelected && selectionNumber ? (
                      <div className="bg-emerald-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                        {selectionNumber}
                      </div>
                    ) : (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isItemSelected}
                          disabled={!canSelect}
                          onCheckedChange={() =>
                            handleCheckboxChange(match.path)
                          }
                        />
                      </div>
                    )}

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 font-mono break-all leading-tight select-none">
                        {pathParts}/
                      </div>
                      <div className="text-sm font-medium text-gray-900 break-words leading-tight select-none">
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
            className={`flex-1 ${
              bulkValidation.canBulkMatch
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            ✓ Confirm Bulk Match ({selectedFilePaths.length}/
            {selectedReferences.length})
          </Button>
        ) : (
          <>
            <Button
              onClick={onConfirmMatch}
              disabled={!bulkValidation.canSingleMatch}
              className={`flex-1 ${
                bulkValidation.canSingleMatch
                  ? "bg-emerald-700 hover:bg-emerald-600"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              ✓ Confirm Match
            </Button>
            <Button
              variant="outline"
              onClick={onSkipReference}
              disabled={!currentReference}
              className={
                !currentReference ? "cursor-not-allowed opacity-50" : ""
              }
            >
              ⏭ Skip
            </Button>
          </>
        )}
      </div>
    </div>
  );
}