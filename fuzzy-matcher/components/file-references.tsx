// fuzzy-matcher/components/file-references.tsx - Fixed Shift+Arrow Range Selection

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileReference } from "@/lib/types";
import { useEffect, useState, useRef, useCallback } from "react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileReferencesProps {
  references: FileReference[];
  selectedReferences: Array<{ item: FileReference; order: number }>;
  currentReference: FileReference | null;
  originalCount: number;
  onSelectReference: (reference: FileReference) => void;
  onToggleSelection: (reference: FileReference) => void;
  onSelectAll: () => void;
  onBulkSkip: () => void;
  onBulkDeselect: () => void;
  onDetectRemaining: () => void;
}

export function FileReferences({
  references,
  selectedReferences,
  currentReference,
  originalCount,
  onSelectReference,
  onToggleSelection,
  onSelectAll,
  onBulkSkip,
  onBulkDeselect,
  onDetectRemaining,
}: FileReferencesProps) {
  const selectedCount = selectedReferences.length;
  const totalCount = references.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  // Separate cursor position from selection logic
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [rangeAnchor, setRangeAnchor] = useState<number>(-1);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Update multi-select mode based on selections
  useEffect(() => {
    setIsMultiSelectMode(selectedCount > 0);
  }, [selectedCount]);

  // Initialize cursor to current reference
  useEffect(() => {
    if (currentReference && !isMultiSelectMode) {
      const index = references.findIndex(ref => ref.description === currentReference.description);
      if (index !== -1) {
        setCursorIndex(index);
      }
    }
  }, [currentReference, references, isMultiSelectMode]);

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

  useEffect(() => {
    if (cursorIndex >= 0 && cursorIndex < references.length) {
      // Small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        scrollToItem(cursorIndex);
      }, 30);

      return () => clearTimeout(timeoutId);
    }
  }, [cursorIndex, scrollToItem, references.length]);

  const getSelectionNumber = (reference: FileReference): number | null => {
    const found = selectedReferences.find((item) => item.item.description === reference.description);
    return found ? found.order : null;
  };

  const isGeneratedReference = (reference: FileReference): boolean => {
    return reference.isGenerated || false;
  };

  const isSelected = (reference: FileReference): boolean => {
    return selectedReferences.some((item) => item.item.description === reference.description);
  };

  // Handle mouse clicks
  const handleReferenceClick = (
    reference: FileReference,
    index: number,
    event: React.MouseEvent
  ) => {
    // Prevent text selection when using Shift
    if (event.shiftKey) {
      event.preventDefault();
    }

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle individual selection & enter multi-select mode
      onToggleSelection(reference);
      setCursorIndex(index);
      setRangeAnchor(index);
    } else if (event.shiftKey && rangeAnchor !== -1) {
      // Shift+Click: Range selection
      event.preventDefault();
      handleRangeSelection(rangeAnchor, index);
      setCursorIndex(index);
    } else {
      // Regular click: Single selection (exit multi-select mode)
      if (isMultiSelectMode) {
        // Clear multi-selections first by deselecting all
        onBulkDeselect();
      }
      onSelectReference(reference);
      setCursorIndex(index);
      setRangeAnchor(index);
    }
  };

  // Fixed range selection that properly handles ranges
  const handleRangeSelection = (startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    // First, get all references that should be selected in this range
    const referencesInRange = new Set<string>();
    for (let i = start; i <= end; i++) {
      const ref = references[i];
      if (ref) {
        referencesInRange.add(ref.description);
      }
    }

    // Find currently selected references that are NOT in the range
    const currentlySelected = new Set(selectedReferences.map(item => item.item.description));
    const referencesToDeselect = new Set<string>();
    
    currentlySelected.forEach(description => {
      if (!referencesInRange.has(description)) {
        referencesToDeselect.add(description);
      }
    });

    // Deselect references outside the range
    referencesToDeselect.forEach(description => {
      const ref = references.find(r => r.description === description);
      if (ref && isSelected(ref)) {
        onToggleSelection(ref);
      }
    });

    // Select all references in the range that aren't already selected
    referencesInRange.forEach(description => {
      const ref = references.find(r => r.description === description);
      if (ref && !isSelected(ref)) {
        onToggleSelection(ref);
      }
    });
  };

  // Fixed keyboard navigation with proper range selection
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!containerRef.current || references.length === 0) return;

    let handled = false;

    switch (event.key) {
      case "ArrowDown":
        if (event.shiftKey) {
          // Shift+Down: Range selection downward
          event.preventDefault();
          if (cursorIndex < references.length - 1) {
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
          if (cursorIndex < references.length - 1) {
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
        const ref = references[cursorIndex];
        if (ref) {
          onToggleSelection(ref);
          setRangeAnchor(cursorIndex);
        }
        handled = true;
        break;

      case "Escape":
        // Escape: Clear all selections and exit multi-select mode
        event.preventDefault();
        if (isMultiSelectMode) {
          onBulkDeselect();
          setRangeAnchor(-1);
        }
        handled = true;
        break;

      case "a":
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+A: Select all
          event.preventDefault();
          onSelectAll();
          setRangeAnchor(0);
          handled = true;
        }
        break;

      case "Enter":
        // Enter: Select current item for matching (single mode)
        if (!isMultiSelectMode) {
          event.preventDefault();
          const ref = references[cursorIndex];
          if (ref) {
            onSelectReference(ref);
          }
          handled = true;
        }
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
  }, [cursorIndex, rangeAnchor, references, selectedReferences, isMultiSelectMode]);

  // Reset states when selections are cleared externally
  useEffect(() => {
    if (selectedCount === 0) {
      setRangeAnchor(-1);
    }
  }, [selectedCount]);

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
      tabIndex={0}
    >
      {/* Header */}
      <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          📋 Client Index References
          {isMultiSelectMode && (
            <Badge
              variant="secondary"
              className="bg-blue-600 text-white text-xs"
            >
              MULTI-SELECT
            </Badge>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
            className="data-[state=checked]:bg-white data-[state=checked]:text-emerald-700"
          />
          <Badge variant="secondary" className="bg-white/20 text-white">
            {selectedCount} selected
          </Badge>
        </div>
      </div>

      {/* Keyboard Instructions */}
      <div className="bg-blue-50 border-b p-2 text-xs text-blue-700">
        <div className="flex gap-4">
          <span>
            <kbd>Space</kbd> toggle
          </span>
          <span>
            <kbd>Shift+↑↓</kbd> range select
          </span>
          <span>
            <kbd>Ctrl+Click</kbd> multi
          </span>
          <span>
            <kbd>Shift+Click</kbd> range
          </span>
          <span>
            <kbd>Esc</kbd> clear
          </span>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="bg-gray-50 border-b p-3 flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onBulkSkip();
              setRangeAnchor(-1);
            }}
            className="text-xs"
          >
            ⏭ Skip Selected ({selectedCount})
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onBulkDeselect();
              setRangeAnchor(-1);
            }}
            className="text-xs"
          >
            ✕ Clear All
          </Button>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={onDetectRemaining}
              className="text-xs"
            >
              📄 Detect Remaining
            </Button>
          </div>
        </div>
      )}

      {/* References List */}
      <ScrollArea className="flex-1 p-3 min-h-0">
        {references.map((reference, index) => {
          const isItemSelected = isSelected(reference);
          const isActive = reference.description === currentReference?.description && !isMultiSelectMode;
          const isCursor = index === cursorIndex;
          const isGenerated = isGeneratedReference(reference);
          const selectionNumber = getSelectionNumber(reference);

          return (
            <div
              key={`${reference.description}-${index}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={`
                bg-gray-50 border rounded-md p-3 cursor-pointer transition-all relative
                hover:bg-gray-100 hover:border-emerald-300
                ${isItemSelected ? "bg-emerald-50 border-emerald-300 border-2" : ""}
                ${isActive ? "bg-green-50 border-green-300 border-2" : ""}
                ${isCursor ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                ${isItemSelected && isActive ? "bg-gradient-to-r from-emerald-50 to-green-50" : ""}
              `}
              onClick={(e) => handleReferenceClick(reference, index, e)}
              onMouseDown={(e) => {
                if (e.shiftKey) {
                  e.preventDefault();
                }
              }}
            >
              {/* Cursor indicator */}
              {isCursor && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-md"></div>
              )}

              <div className="flex items-start gap-3">
                {/* Selection Indicator */}
                {isItemSelected && selectionNumber ? (
                  <div className="bg-emerald-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                    {selectionNumber}
                  </div>
                ) : (
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 mt-1">
                    <Checkbox
                      checked={isItemSelected}
                      onCheckedChange={() => {
                        onToggleSelection(reference);
                        setRangeAnchor(index);
                      }}
                    />
                  </div>
                )}

                {/* Reference Content */}
                <div className="flex items-start justify-between flex-1 min-w-0 gap-3">
                  {/* Description */}
                  <div className="text-sm text-gray-700 leading-relaxed select-none flex-1">
                    {reference.description}
                  </div>

                  {/* Badges Container */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {/* Date Badge */}
                      {reference.date && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-xs border-blue-300 text-blue-700 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(reference.date || '');
                              }}
                            >
                              {reference.date}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Date - click to copy</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    
                    {/* Reference Badge */}
                    {reference.reference && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-xs border-purple-300 text-purple-700 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(reference.reference || '');
                              }}
                            >
                              {reference.reference}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reference - click to copy</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}