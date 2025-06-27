// fuzzy-matcher/components/file-references.tsx - Optimized with react-window (UI unchanged)

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
import { HelpCircle } from "lucide-react";
import { FixedSizeList as List } from 'react-window';

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

// Virtualized list item component - keeping exact original styling
interface ListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    references: FileReference[];
    selectedReferences: Array<{ item: FileReference; order: number }>;
    currentReference: FileReference | null;
    cursorIndex: number;
    isMultiSelectMode: boolean;
    onSelectReference: (reference: FileReference) => void;
    onToggleSelection: (reference: FileReference) => void;
    handleReferenceClick: (reference: FileReference, index: number, event: React.MouseEvent) => void;
    getSelectionNumber: (reference: FileReference) => number | null;
    isSelected: (reference: FileReference) => boolean;
    itemRefs: React.MutableRefObject<{ [key: number]: HTMLDivElement | null }>;
    setRangeAnchor: (anchor: number) => void;
  };
}

const ListItem: React.FC<ListItemProps> = ({ index, style, data }) => {
  const {
    references,
    selectedReferences,
    currentReference,
    cursorIndex,
    isMultiSelectMode,
    onSelectReference,
    onToggleSelection,
    handleReferenceClick,
    getSelectionNumber,
    isSelected,
    itemRefs,
    setRangeAnchor,
  } = data;

  const reference = references[index];
  if (!reference) return null;

  const isItemSelected = isSelected(reference);
  const isActive = reference.id === currentReference?.id && !isMultiSelectMode;
  const isCursor = index === cursorIndex;
  const selectionNumber = getSelectionNumber(reference);

  return (
    <div style={style} className="px-3 py-1" key={`item-${index}`}>
      <div
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
          <div className="flex-1 min-w-0 max-w-sm">
            {/* Description */}
            <div className="text-sm text-gray-700 leading-relaxed select-none text-balance mb-2">
              {reference.description}
            </div>

            {/* Badges Container */}
            <div className="flex flex-wrap gap-1">
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
    </div>
  );
};

export function FileReferences({
  references,
  selectedReferences,
  currentReference,
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
  const listRef = useRef<List>(null);

  // Update multi-select mode based on selections
  useEffect(() => {
    setIsMultiSelectMode(selectedCount > 0);
  }, [selectedCount]);

  // Initialize cursor to current reference
  useEffect(() => {
    if (currentReference && !isMultiSelectMode) {
      const index = references.findIndex(ref => ref.id === currentReference.id);
      if (index !== -1) {
        setCursorIndex(index);
      }
    }
  }, [currentReference, references, isMultiSelectMode]);

  const scrollToItem = useCallback((index: number) => {
    if (listRef.current) {
      listRef.current.scrollToItem(index, 'smart');
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
    const found = selectedReferences.find((item) => item.item.id === reference.id);
    return found ? found.order : null;
  };

  const isGeneratedReference = (reference: FileReference): boolean => {
    return reference.isGenerated || false;
  };

  const isSelected = (reference: FileReference): boolean => {
    return selectedReferences.some((item) => item.item.id === reference.id);
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
        referencesInRange.add(ref.id);
      }
    }

    // Find currently selected references that are NOT in the range
    const currentlySelected = new Set(selectedReferences.map(item => item.item.id));
    const referencesToDeselect = new Set<string>();
    
    currentlySelected.forEach(id => {
      if (!referencesInRange.has(id)) {
        referencesToDeselect.add(id);
      }
    });

    // Deselect references outside the range
    referencesToDeselect.forEach(id => {
      const ref = references.find(r => r.id === id);
      if (ref && isSelected(ref)) {
        onToggleSelection(ref);
      }
    });

    // Select all references in the range that aren't already selected
    referencesInRange.forEach(id => {
      const ref = references.find(r => r.id === id);
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

  // Prepare data for virtualized list
  const itemData = {
    references,
    selectedReferences,
    currentReference,
    cursorIndex,
    isMultiSelectMode,
    onSelectReference,
    onToggleSelection,
    handleReferenceClick,
    getSelectionNumber,
    isSelected,
    itemRefs,
    setRangeAnchor,
  };

  const itemHeight = 95; // Height per item to match original styling

  return (
   <div
  ref={containerRef}
  className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
  tabIndex={0}
>
  {/* Header - EXACT original styling */}
  <div className="bg-emerald-700 text-white px-4 py-2 flex justify-between items-center relative">
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
      <Badge variant="secondary" className="bg-white/20 text-white">
        {selectedCount} selected
      </Badge>
      {/* Keyboard Instructions */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help ml-2">
              <HelpCircle className="h-4 w-4 text-white/80 hover:text-white transition-colors" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm border-b bg-blue-50 text-blue-800">
            <div className="flex gap-4 text-xs">
              <span>
                <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Space</kbd> toggle
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Shift+↑↓</kbd> range
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Ctrl+Click</kbd> multi
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Esc</kbd> clear
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>

      {/* References List - ONLY this part optimized with react-window */}
      <div className="flex-1 min-h-0 bg-transparent">
        {references.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No references available</p>
              <p className="text-sm">Upload a client index to get started</p>
            </div>
          </div>
        ) : (
          <List
            ref={listRef}
            height={containerRef.current?.clientHeight ? Math.max(containerRef.current.clientHeight - 60, 200) : 400}
            itemCount={references.length}
            itemSize={itemHeight}
            itemData={itemData}
            className="w-full"
            style={{ backgroundColor: 'transparent', outline: 'none' }}
            overscanCount={5}
          >
            {ListItem}
          </List>
        )}
      </div>
    </div>
  );
}