// fuzzy-matcher/components/file-references.tsx - Converted to AG Grid

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileReference } from "@/lib/types";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

// Import AG Grid
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  GridReadyEvent, 
  GridApi, 
  CellClickedEvent,
  RowNode,
  CellKeyDownEvent
} from 'ag-grid-community';

// Import required AG Grid modules
import { ModuleRegistry } from 'ag-grid-community'; 
import { AllEnterpriseModule } from 'ag-grid-enterprise';

// Register all Community and Enterprise features
ModuleRegistry.registerModules([AllEnterpriseModule]);

// Import styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface FileReferencesProps {
  references: FileReference[];
  selectedReferences: Array<{ item: FileReference; order: number }>;
  currentReference: FileReference | null;
  originalCount?: number;
  onSelectReference: (reference: FileReference) => void;
  onToggleSelection: (reference: FileReference) => void;
  onSelectAll: () => void;
  onBulkSkip: () => void;
  onBulkDeselect: () => void;
  onDetectRemaining: () => void;
}

// Custom Selection Cell Renderer
const SelectionCellRenderer = (props: any) => {
  const { data, node, api } = props;
  
  if (!node || !data) return null;
  
  // Get the current context from the grid API
  const gridContext = api.getGridOption('context');
  const { selectedReferences = [], cursorRowId, onToggleSelection, isMultiSelectMode } = gridContext || {};
  
  // More precise cursor detection - ensure only ONE cell has cursor at a time
  const isCursor = Boolean(
    cursorRowId && 
    data.id && 
    data.id === cursorRowId && 
    typeof data.id === 'string' && 
    typeof cursorRowId === 'string'
  );
  
  // Find if this item is selected - more explicit check
  const selection = selectedReferences.find((sel: any) => sel.item && sel.item.id === data.id);
  const isSelected = Boolean(selection);
  const orderNumber = selection?.order;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(data, e);
    }
  };
  
  return (
    <div 
      key={`selection-${data.id}-${isSelected}-${isCursor}-${cursorRowId}`} // More specific key
      className={`
        flex items-center justify-center h-full w-full cursor-pointer relative
        transition-all duration-200
        ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
        ${isSelected ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'}
      `}
      onClick={handleClick}
    >
      {/* Cursor indicator - only show if truly cursor */}
      {isCursor && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l"></div>
      )}
      
      {isSelected && orderNumber ? (
        <div className="bg-emerald-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border border-emerald-800">
          {orderNumber}
        </div>
      ) : (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => {
            if (onToggleSelection) {
              onToggleSelection(data);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};

// Description Cell Renderer with badges
const DescriptionCellRenderer = (props: any) => {
  const { value, data, api } = props;
  
  if (!data) return null;
  
  const gridContext = api.getGridOption('context');
  const { cursorRowId, selectedReferences = [] } = gridContext || {};
  
  // More precise cursor detection - ensure only ONE cell has cursor at a time
  const isCursor = Boolean(
    cursorRowId && 
    data.id && 
    data.id === cursorRowId && 
    typeof data.id === 'string' && 
    typeof cursorRowId === 'string'
  );
  const isSelected = selectedReferences.some((sel: any) => sel.item && sel.item.id === data.id);
  
  return (
    <div 
      key={`description-${data.id}-${isSelected}-${isCursor}-${cursorRowId}`} // More specific key
      className={`
        flex flex-col gap-2 py-2 relative transition-all duration-200
        ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
        ${isSelected ? 'bg-emerald-50' : 'bg-white'}
      `}
    >
      {/* Cursor indicator - only show if truly cursor */}
      {isCursor && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l"></div>
      )}
      
      {/* Description */}
      <div className="text-sm text-gray-700 leading-relaxed select-none text-balance">
        {value}
      </div>
      
      {/* Badges Container */}
      <div className="flex flex-wrap gap-1">
        {/* Date Badge */}
        {data.date && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs border-blue-300 text-blue-700 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(data.date || '');
                  }}
                >
                  {data.date}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Date - click to copy</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {/* Reference Badge */}
        {data.reference && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs border-purple-300 text-purple-700 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(data.reference || '');
                  }}
                >
                  {data.reference}
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
  );
};

// Date Cell Renderer
const DateCellRenderer = (props: any) => {
  const { value } = props;
  
  if (!value) return <span className="text-gray-400">-</span>;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs border-blue-300 text-blue-700 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(value);
            }}
          >
            {value}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to copy date</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Reference Cell Renderer
const ReferenceCellRenderer = (props: any) => {
  const { value } = props;
  
  if (!value) return <span className="text-gray-400">-</span>;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs border-purple-300 text-purple-700 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(value);
            }}
          >
            {value}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to copy reference</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [cursorRowId, setCursorRowId] = useState<string | null>(null);
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [rangeAnchor, setRangeAnchor] = useState<number>(-1);
  
  const selectedCount = selectedReferences.length;
  const totalCount = references.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const isMultiSelectMode = selectedCount > 0;

  // Initialize cursor to current reference
  useEffect(() => {
    if (currentReference && !isMultiSelectMode) {
      setCursorRowId(currentReference.id);
      const index = references.findIndex(ref => ref.id === currentReference.id);
      if (index !== -1) {
        setCursorIndex(index);
      }
    } else if (references.length > 0 && !cursorRowId) {
      setCursorRowId(references[0].id);
      setCursorIndex(0);
    }
  }, [currentReference, references, isMultiSelectMode, cursorRowId]);

  // Helper function to get all visible (filtered) references in order
  const getVisibleReferences = useCallback((): FileReference[] => {
    if (!gridApi) return references;
    
    const visibleRefs: FileReference[] = [];
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data) {
        visibleRefs.push(node.data);
      }
    });
    return visibleRefs;
  }, [gridApi, references]);

  // Helper function to convert cursor index to row ID based on visible references
  const getRowIdFromIndex = useCallback((index: number): string | null => {
    const visibleRefs = getVisibleReferences();
    return visibleRefs[index]?.id || null;
  }, [getVisibleReferences]);

  // Helper function to get index of current cursor in visible references
  const getCurrentCursorIndex = useCallback((): number => {
    if (!cursorRowId) return 0;
    const visibleRefs = getVisibleReferences();
    const index = visibleRefs.findIndex(ref => ref.id === cursorRowId);
    return index === -1 ? 0 : index;
  }, [cursorRowId, getVisibleReferences]);

  // Update cursor index when cursor row ID changes - more robust sync
  useEffect(() => {
    if (cursorRowId && gridApi) {
      const visibleRefs = getVisibleReferences();
      const newIndex = visibleRefs.findIndex(ref => ref.id === cursorRowId);
      if (newIndex !== -1 && newIndex !== cursorIndex) {
        setCursorIndex(newIndex);
      } else if (newIndex === -1) {
        // Cursor row not visible, reset to first visible
        setCursorRowId(visibleRefs[0]?.id || null);
        setCursorIndex(0);
      }
    }
  }, [cursorRowId, gridApi, getVisibleReferences, cursorIndex]);

  // Natural sort comparator for alphanumeric sorting
  const naturalComparator = useCallback((valueA: any, valueB: any): number => {
    // Handle null/undefined values
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return -1;
    if (valueB == null) return 1;
    
    // Convert to strings for comparison
    const strA = String(valueA);
    const strB = String(valueB);
    
    // Use localeCompare with numeric option for natural sorting
    return strA.localeCompare(strB, undefined, {
      numeric: true,
      sensitivity: 'base',
      caseFirst: 'lower'
    });
  }, []);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '',
      field: 'select',
      width: 60,
      pinned: 'left',
      sortable: false,
      filter: false,
      cellRenderer: SelectionCellRenderer,
      cellStyle: { padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Description',
      field: 'description',
      flex: 2,
      cellRenderer: DescriptionCellRenderer,
      cellStyle: { padding: '8px' },
      sortable: true,
      comparator: naturalComparator, // Natural sorting for descriptions with numbers
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith'],
        debounceMs: 300
      }
    },
    {
      headerName: 'Date',
      field: 'date',
      width: 120,
      cellRenderer: DateCellRenderer,
      cellStyle: { padding: '8px', display: 'flex', alignItems: 'center' },
      sortable: true,
      comparator: naturalComparator, // Natural sorting for dates with numbers
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'equals'],
        debounceMs: 300
      }
    },
    {
      headerName: 'Reference',
      field: 'reference',
      width: 140,
      cellRenderer: ReferenceCellRenderer,
      cellStyle: { padding: '8px', display: 'flex', alignItems: 'center' },
      sortable: true,
      comparator: naturalComparator, // Natural sorting for references with numbers
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'equals'],
        debounceMs: 300
      }
    }
  ], [naturalComparator]);

  // Grid options
  const gridOptions = useMemo(() => ({
    suppressRowClickSelection: true,
    rowHeight: 85, // Similar to original card height
    headerHeight: 40,
    rowBuffer: 10,
    suppressRowVirtualisation: false,
    animateRows: false,
    suppressColumnMoveAnimation: true,
    defaultColDef: {
      resizable: true,
      sortable: true
    },
    getRowId: (params: any) => params.data.id,
    enableCellTextSelection: false,
    suppressMenuHide: true,
    rowSelection: 'multiple' as const,
    suppressRowDeselection: false
  }), []);

  // Selection helper functions
  const getSelectionNumber = (reference: FileReference): number | null => {
    const found = selectedReferences.find((item) => item.item.id === reference.id);
    return found ? found.order : null;
  };

  const isSelected = (reference: FileReference): boolean => {
    return selectedReferences.some((item) => item.item.id === reference.id);
  };

  // Enhanced toggle selection with event handling
  const handleToggleSelection = useCallback((reference: FileReference, event?: React.MouseEvent) => {
    if (event?.ctrlKey || event?.metaKey) {
      // Ctrl+Click: Toggle individual selection
      onToggleSelection(reference);
      setCursorRowId(reference.id);
      const visibleRefs = getVisibleReferences();
      const index = visibleRefs.findIndex(ref => ref.id === reference.id);
      if (index !== -1) {
        setCursorIndex(index);
        setRangeAnchor(index);
      }
    } else if (event?.shiftKey && rangeAnchor !== -1) {
      // Shift+Click: Range selection
      event.preventDefault();
      const visibleRefs = getVisibleReferences();
      const endIndex = visibleRefs.findIndex(ref => ref.id === reference.id);
      if (endIndex !== -1) {
        handleRangeSelection(rangeAnchor, endIndex);
        setCursorRowId(reference.id);
        setCursorIndex(endIndex);
      }
    } else {
      // Regular toggle or checkbox click
      onToggleSelection(reference);
      if (!isMultiSelectMode) {
        setCursorRowId(reference.id);
        const visibleRefs = getVisibleReferences();
        const index = visibleRefs.findIndex(ref => ref.id === reference.id);
        if (index !== -1) {
          setCursorIndex(index);
          setRangeAnchor(index);
        }
      }
    }
  }, [onToggleSelection, rangeAnchor, isMultiSelectMode, getVisibleReferences]);

  // Range selection logic with chronological order
  const handleRangeSelection = useCallback((startIndex: number, endIndex: number) => {
    const visibleRefs = getVisibleReferences();
    
    // Clear all existing selections first
    selectedReferences.forEach(selection => {
      onToggleSelection(selection.item);
    });

    // Determine selection direction and create chronological order
    const selectionDirection = endIndex > startIndex ? 'down' : 'up';
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    // Create selection array based on chronological order of selection
    const referencesToSelect: FileReference[] = [];
    
    if (selectionDirection === 'down') {
      // Selecting downward: start gets 1, next gets 2, etc.
      for (let i = start; i <= end; i++) {
        const ref = visibleRefs[i];
        if (ref) {
          referencesToSelect.push(ref);
        }
      }
    } else {
      // Selecting upward: start gets 1, previous gets 2, etc.
      for (let i = end; i >= start; i--) {
        const ref = visibleRefs[i];
        if (ref) {
          referencesToSelect.push(ref);
        }
      }
    }
    
    // Apply selections in chronological order
    referencesToSelect.forEach(ref => {
      onToggleSelection(ref);
    });
  }, [getVisibleReferences, selectedReferences, onToggleSelection]);

  // Update grid context when state changes
  useEffect(() => {
    if (gridApi) {
      const newContext = {
        selectedReferences,
        cursorRowId,
        onToggleSelection: handleToggleSelection,
        isMultiSelectMode
      };

      gridApi.setGridOption('context', newContext);

      // Force immediate and aggressive refresh of all cells
      gridApi.refreshCells({
        force: true,
        suppressFlash: false
      });
      
      // Double refresh for stubborn visual states
      setTimeout(() => {
        gridApi.refreshCells({
          force: true,
          suppressFlash: true
        });
      }, 5);
    }
  }, [gridApi, selectedReferences, cursorRowId, handleToggleSelection, isMultiSelectMode]);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);

    if (references.length > 0) {
      setCursorRowId(currentReference?.id || references[0].id);
    }

    const initialContext = {
      selectedReferences,
      cursorRowId: currentReference?.id || references[0]?.id || null,
      onToggleSelection: handleToggleSelection,
      isMultiSelectMode
    };

    params.api.setGridOption('context', initialContext);
  }, [references, currentReference, selectedReferences, handleToggleSelection, isMultiSelectMode]);

  // Handle cell clicks
  const onCellClicked = useCallback((event: CellClickedEvent) => {
    if (event.colDef.field === 'select') {
      return; // Selection handled by cell renderer
    }

    const reference = event.data;
    if (!reference) return;

    const visibleRefs = getVisibleReferences();
    const clickIndex = visibleRefs.findIndex(ref => ref.id === reference.id);
    
    if (clickIndex === -1) return;

    if (event.event?.ctrlKey || event.event?.metaKey) {
      // Ctrl+Click: Toggle selection
      handleToggleSelection(reference, event.event as React.MouseEvent);
    } else if (event.event?.shiftKey && rangeAnchor !== -1) {
      // Shift+Click: Range selection
      handleRangeSelection(rangeAnchor, clickIndex);
      setCursorRowId(reference.id);
      setCursorIndex(clickIndex);
    } else {
      // Regular click: Single selection (exit multi-select mode)
      if (isMultiSelectMode) {
        onBulkDeselect();
      }
      onSelectReference(reference);
      setCursorRowId(reference.id);
      setCursorIndex(clickIndex);
      setRangeAnchor(clickIndex);
    }
  }, [handleToggleSelection, rangeAnchor, handleRangeSelection, isMultiSelectMode, onBulkDeselect, onSelectReference, getVisibleReferences]);

  // Handle keyboard events
  const onCellKeyDown = useCallback((event: CellKeyDownEvent) => {
    const { key, ctrlKey, metaKey, shiftKey } = event.event;
    
    if (!gridApi) return;

    const visibleRefs = getVisibleReferences();
    const currentIndex = getCurrentCursorIndex();
    let handled = false;

    switch (key) {
      case 'ArrowDown':
        if (shiftKey) {
          // Shift+Down: Range selection downward
          event.event.preventDefault();
          if (currentIndex < visibleRefs.length - 1) {
            const newCursorIndex = currentIndex + 1;
            
            // If no anchor set, start range selection
            if (rangeAnchor === -1) {
              setRangeAnchor(currentIndex);
            }
            
            // Perform range selection from anchor to new cursor position
            handleRangeSelection(rangeAnchor, newCursorIndex);
            
            // Update cursor
            const newRowId = getRowIdFromIndex(newCursorIndex);
            if (newRowId) {
              setCursorRowId(newRowId);
              setCursorIndex(newCursorIndex);
            }
          }
        } else {
          // Down: Move cursor
          event.event.preventDefault();
          if (currentIndex < visibleRefs.length - 1) {
            const newCursorIndex = currentIndex + 1;
            const newRowId = getRowIdFromIndex(newCursorIndex);
            if (newRowId) {
              setCursorRowId(newRowId);
              setCursorIndex(newCursorIndex);
              // Reset anchor when not using shift
              setRangeAnchor(-1);
            }
          }
        }
        handled = true;
        break;

      case 'ArrowUp':
        if (shiftKey) {
          // Shift+Up: Range selection upward
          event.event.preventDefault();
          if (currentIndex > 0) {
            const newCursorIndex = currentIndex - 1;
            
            // If no anchor set, start range selection
            if (rangeAnchor === -1) {
              setRangeAnchor(currentIndex);
            }
            
            // Perform range selection from anchor to new cursor position
            handleRangeSelection(rangeAnchor, newCursorIndex);
            
            // Update cursor
            const newRowId = getRowIdFromIndex(newCursorIndex);
            if (newRowId) {
              setCursorRowId(newRowId);
              setCursorIndex(newCursorIndex);
            }
          }
        } else {
          // Up: Move cursor
          event.event.preventDefault();
          if (currentIndex > 0) {
            const newCursorIndex = currentIndex - 1;
            const newRowId = getRowIdFromIndex(newCursorIndex);
            if (newRowId) {
              setCursorRowId(newRowId);
              setCursorIndex(newCursorIndex);
              // Reset anchor when not using shift
              setRangeAnchor(-1);
            }
          }
        }
        handled = true;
        break;

      case ' ':
        // Space: Toggle selection at cursor
        event.event.preventDefault();
        const currentRef = visibleRefs[currentIndex];
        if (currentRef) {
          handleToggleSelection(currentRef);
          setRangeAnchor(currentIndex);
        }
        handled = true;
        break;

      case 'Escape':
        // Escape: Clear all selections and reset all states
        event.event.preventDefault();
        if (isMultiSelectMode) {
          // Step 1: Clear ALL state immediately
          const targetCursor = currentReference ? currentReference.id : (visibleRefs[0]?.id || null);
          
          setCursorRowId(null);  // Force clear cursor
          setRangeAnchor(-1);
          onBulkDeselect();      // Clear selections
          
          // Step 2: Force complete grid refresh
          setTimeout(() => {
            if (gridApi) {
              gridApi.refreshCells({ force: true, suppressFlash: false });
              gridApi.redrawRows();
              
              // Step 3: Set single cursor after everything is cleared
              setTimeout(() => {
                setCursorRowId(targetCursor);
                
                if (targetCursor) {
                  const newIndex = visibleRefs.findIndex(ref => ref.id === targetCursor);
                  setCursorIndex(newIndex !== -1 ? newIndex : 0);
                }
                
                // Final refresh to apply cursor
                setTimeout(() => {
                  gridApi.refreshCells({ force: true });
                }, 20);
              }, 30);
            }
          }, 10);
        }
        handled = true;
        break;

      case 'a':
        if (ctrlKey || metaKey) {
          // Ctrl+A: Select all
          event.event.preventDefault();
          onSelectAll();
          setRangeAnchor(0);
          handled = true;
        }
        break;

      case 'Enter':
        // Enter: Select current item for matching (single mode)
        if (!isMultiSelectMode) {
          event.event.preventDefault();
          const ref = visibleRefs[currentIndex];
          if (ref) {
            onSelectReference(ref);
          }
          handled = true;
        }
        break;
    }

    if (handled) {
      event.event.stopPropagation();
    }
  }, [gridApi, getCurrentCursorIndex, getVisibleReferences, getRowIdFromIndex, rangeAnchor, handleRangeSelection, handleToggleSelection, isMultiSelectMode, onBulkDeselect, onSelectAll, onSelectReference]);

  // Clear states when selections are cleared externally
  useEffect(() => {
    if (selectedCount === 0) {
      setRangeAnchor(-1);
      
      // Only reset cursor if we're not already in a clearing operation
      if (gridApi && cursorRowId) {
        // Determine target cursor position
        const targetCursor = currentReference ? currentReference.id : (references[0]?.id || null);
        
        // Only update if different from current
        if (targetCursor && targetCursor !== cursorRowId) {
          setCursorRowId(targetCursor);
          const index = references.findIndex(ref => ref.id === targetCursor);
          if (index !== -1) {
            setCursorIndex(index);
          }
          
          // Force refresh after cursor update
          setTimeout(() => {
            gridApi.refreshCells({ force: true });
          }, 10);
        }
      }
    }
  }, [selectedCount, currentReference, references, gridApi, cursorRowId]);

  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full focus:outline-none focus:ring-2 focus:ring-emerald-500">
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
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span>
                    <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">↑↓</kbd> navigate
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Space</kbd> toggle
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Shift+↑↓</kbd> range
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Shift+Click</kbd> range
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

      {/* AG Grid - Replaces the virtualized list */}
      <div className="flex-1 ag-theme-alpine">
        {references.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">No references available</p>
              <p className="text-sm">Upload a client index to get started</p>
            </div>
          </div>
        ) : (
          <AgGridReact
            ref={gridRef}
            rowData={references}
            columnDefs={columnDefs}
            gridOptions={gridOptions}
            onGridReady={onGridReady}
            onCellClicked={onCellClicked}
            onCellKeyDown={onCellKeyDown}
            theme="legacy"
          />
        )}
      </div>

      {/* Footer with action buttons - kept from original */}
      <div className="border-t bg-gray-50 p-3">
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onSelectAll}
            className="text-xs"
          >
            {allSelected ? "Deselect All" : `Select All (${totalCount})`}
          </Button>
          
          {selectedCount > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkDeselect}
                className="text-xs"
              >
                ✕ Deselect ({selectedCount})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onBulkSkip}
                className="text-xs"
              >
                ⏭ Skip Selected
              </Button>
            </>
          )}
          
          
        </div>
      </div>
    </div>
  );
}