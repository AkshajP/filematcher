// components/new-document-selector.tsx
'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Settings, Table, TreePine, HelpCircle } from 'lucide-react';
import { FileReference, MatchedPair, generateUniqueId } from '@/lib/types';

// Import required AG Grid modules
import { ModuleRegistry } from 'ag-grid-community'; 
import { AllEnterpriseModule } from 'ag-grid-enterprise';

// Register all Community and Enterprise features
ModuleRegistry.registerModules([AllEnterpriseModule]);

import { 
  ColDef, 
  GridReadyEvent, 
  GridApi, 
  ITextFilterParams,
  CellClickedEvent,
  RowNode,
  CellKeyDownEvent,
} from 'ag-grid-community';

// Import styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { AGGridSearchParser } from '@/lib/ag-grid-search-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface DocumentFile {
  id: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  dateModified?: string;
  fileType?: string;
}

interface TreeDataFile extends DocumentFile {
  folderHierarchy: string[];
}

interface OrderedSelection {
  item: DocumentFile;
  order: number;
}

type ViewMode = 'table' | 'tree';

interface NewDocumentSelectorProps {
  documentFiles: DocumentFile[];
  selectedDocuments: OrderedSelection[];
  onSelectionChange: (selections: OrderedSelection[]) => void;
  currentReferences: Array<{ item: FileReference; order: number }>;
  onConfirmMapping: () => void;
  matchedPairs: MatchedPair[]; // NEW: Add matched pairs to filter out used documents
}

// Build tree data using the simpler approach
const buildTreeData = (files: DocumentFile[]): TreeDataFile[] => {
  return files.map(file => {
    const parts = file.filePath.split('/').filter(Boolean);
    const fileName = parts.pop() || file.fileName;
    return {
      ...file,
      fileName,
      folderHierarchy: parts
    };
  });
};

const SelectionCellRenderer = (props: any) => {
  const { data, node, api } = props;
  
  if (!node) return null;
  
  // Get the current context from the grid API
  const gridContext = api.getGridOption('context');
  const { selectedFiles, cursorRowId, onToggleSelection, onToggleFolderSelection, viewMode } = gridContext || {};
  
  // Handle folder nodes (groups) in tree view
  if (node.group && viewMode === 'tree') {
    // Get child files using AG Grid's tree node structure
    const childFiles: any[] = [];
    
    // Use AG Grid's forEachNode to get all descendant file nodes
    const collectChildFiles = (currentNode: any) => {
      if (currentNode.childrenAfterGroup) {
        currentNode.childrenAfterGroup.forEach((child: any) => {
          if (child.group) {
            // Recursively collect from child folders
            collectChildFiles(child);
          } else if (child.data && !child.group) {
            // This is a file node
            childFiles.push(child.data);
          }
        });
      }
    };
    
    collectChildFiles(node);
    
    const selectedChildFiles = childFiles.filter(file => 
      selectedFiles?.some((sel: OrderedSelection) => sel.item.id === file.id)
    );
    
    const isFullySelected = childFiles.length > 0 && selectedChildFiles.length === childFiles.length;
    const isPartiallySelected = selectedChildFiles.length > 0 && selectedChildFiles.length < childFiles.length;
    
    const handleFolderClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleFolderSelection && childFiles.length > 0) {
        onToggleFolderSelection(node, childFiles);
      }
    };
    
    return (
      <div 
        className="flex items-center justify-center h-full w-full cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleFolderClick}
      >
        {isFullySelected ? (
          <div className="bg-emerald-700 text-white w-4 h-4 rounded flex items-center justify-center border-2 border-emerald-800">
            <span className="text-xs font-bold">✓</span>
          </div>
        ) : isPartiallySelected ? (
          <div className="bg-blue-500 text-white w-4 h-4 rounded flex items-center justify-center border-2 border-blue-600">
            <span className="text-xs font-bold">−</span>
          </div>
        ) : (
          <div className="w-4 h-4 border-2 border-gray-300 rounded hover:border-gray-400 transition-colors"></div>
        )}
      </div>
    );
  }
  
  // Handle file nodes
  if (!data) return null;
  
  // Find if this item is selected
  const selection = selectedFiles?.find((sel: OrderedSelection) => sel.item.id === data.id);
  const isSelected = !!selection;
  const isCursor = cursorRowId && data.id === cursorRowId;
  const orderNumber = selection?.order;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(data, e);
    }
  };
  
  return (
    <div 
      key={`selection-${data.id}-${isSelected}-${isCursor}-${cursorRowId}`}
      className={`
        flex items-center justify-center h-full w-full cursor-pointer relative
        transition-all duration-200
        ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
        ${isSelected ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'}
      `}
      onClick={handleClick}
    >
      {/* Cursor indicator */}
      {isCursor && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l"></div>
      )}
      
      {isSelected && orderNumber ? (
        <div className="bg-emerald-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-emerald-800">
          {orderNumber}
        </div>
      ) : (
        <div className="w-4 h-4 border-2 border-gray-300 rounded hover:border-gray-400 transition-colors"></div>
      )}
    </div>
  );
};

// Custom cell renderers
const FileSizeCellRenderer = (props: any) => {
  const { value, node } = props;
  
  // Don't show size for group nodes (folders)
  if (node.group || !value) return '-';
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };
  
  return formatBytes(value);
};

// Table view file path renderer
const FilePathCellRenderer = (props: any) => {
  const { value, data, api } = props;
  
  // Get the current context from the grid API
  const gridContext = api.getGridOption('context');
  const { cursorRowId } = gridContext || {};
  
  const pathParts = value.split('/').filter((part: string) => part);
  const folders = pathParts.slice(0, -1);
  const isCursor = cursorRowId && data.id === cursorRowId;
  
  return (
    <div 
      key={`filepath-${data.id}-${isCursor}-${cursorRowId}`}
      className={`flex flex-col relative transition-all duration-200 ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
    >
      {/* Cursor indicator */}
      {isCursor && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l"></div>
      )}
      
      {folders.length > 0 && (
        <span className="text-xs text-gray-500">
          /{folders.join('/')}/
        </span>
      )}
      <span className="font-medium text-sm">{data.fileName}</span>
    </div>
  );
};

// Auto group column renderer with folder/file icons
const AutoGroupCellRenderer = (props: any) => {
  const { value, node, data, api } = props;
  
  // Get the current context from the grid API
  const gridContext = api.getGridOption('context');
  const { cursorRowId } = gridContext || {};
  
  const isCursor = data && cursorRowId && data.id === cursorRowId;
  const isGroup = node.group;
  const isExpanded = node.expanded;
  
  // For group nodes (folders)
  if (isGroup) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">
          {isExpanded ? '📂' : '📁'}
        </span>
        <span className="font-medium text-gray-700">{value}</span>
        <span className="text-xs text-gray-400 ml-2">
          ({node.allChildrenCount || 0} items)
        </span>
      </div>
    );
  }
  
  // For file nodes
  return (
    <div 
      key={`autogroup-${data?.id}-${isCursor}-${cursorRowId}`}
      className={`flex items-center gap-2 relative transition-all duration-200 ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
    >
      {/* Cursor indicator */}
      {isCursor && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l"></div>
      )}
      
      <span className="text-sm">
        {data?.fileType === 'pdf' ? '📄' : 
         data?.fileType === 'docx' ? '📝' : 
         data?.fileType === 'xlsx' ? '📊' : 
         data?.fileType === 'jpg' || data?.fileType === 'png' ? '🖼️' : '📄'}
      </span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
};

export const NewDocumentSelector: React.FC<NewDocumentSelectorProps> = ({
  documentFiles,
  selectedDocuments,
  onSelectionChange,
  currentReferences,
  onConfirmMapping,
  matchedPairs // NEW: Receive matched pairs
}) => {
  const gridRef = useRef<AgGridReact>(null);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cursorRowId, setCursorRowId] = useState<string | null>(null);
  const [cursorIndex, setCursorIndex] = useState<number>(0);
  const [rangeAnchor, setRangeAnchor] = useState<number>(-1);

  // NEW: Filter out already mapped documents
  const availableDocuments = useMemo(() => {
    const usedPaths = new Set(matchedPairs.map(pair => pair.path));
    return documentFiles.filter(doc => !usedPaths.has(doc.filePath));
  }, [documentFiles, matchedPairs]);

  // Transform data based on view mode using filtered documents
  const displayData = useMemo(() => {
    if (viewMode === 'tree') {
      return buildTreeData(availableDocuments);
    }
    return availableDocuments;
  }, [availableDocuments, viewMode]);

  // Helper function to get all visible (filtered) documents in order
  const getVisibleDocuments = useCallback((): DocumentFile[] => {
    if (!gridApi) return displayData;
    
    const visibleDocs: DocumentFile[] = [];
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data && !node.group) {
        visibleDocs.push(node.data);
      }
    });
    return visibleDocs;
  }, [gridApi, displayData]);

  // Helper function to convert cursor index to row ID based on visible documents
  const getRowIdFromIndex = useCallback((index: number): string | null => {
    const visibleDocs = getVisibleDocuments();
    return visibleDocs[index]?.id || null;
  }, [getVisibleDocuments]);

  // Helper function to get index of current cursor in visible documents
  const getCurrentCursorIndex = useCallback((): number => {
    if (!cursorRowId) return 0;
    const visibleDocs = getVisibleDocuments();
    const index = visibleDocs.findIndex(doc => doc.id === cursorRowId);
    return index === -1 ? 0 : index;
  }, [cursorRowId, getVisibleDocuments]);

  // Update cursor index when cursor row ID changes
  useEffect(() => {
    if (cursorRowId && gridApi) {
      const visibleDocs = getVisibleDocuments();
      const newIndex = visibleDocs.findIndex(doc => doc.id === cursorRowId);
      if (newIndex !== -1 && newIndex !== cursorIndex) {
        setCursorIndex(newIndex);
      } else if (newIndex === -1) {
        // Cursor row not visible, reset to first visible
        setCursorRowId(visibleDocs[0]?.id || null);
        setCursorIndex(0);
      }
    }
  }, [cursorRowId, gridApi, getVisibleDocuments, cursorIndex]);

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

  // Selection management functions
  const toggleSelection = useCallback((item: DocumentFile, event?: React.MouseEvent) => {
    const existingIndex = selectedDocuments.findIndex(sel => sel.item.id === item.id);
    
    const visibleDocs = getVisibleDocuments();
    const itemIndex = visibleDocs.findIndex(doc => doc.id === item.id);
    
    if (event?.ctrlKey || event?.metaKey) {
      // Ctrl+Click: Toggle individual selection
      if (existingIndex >= 0) {
        // Remove existing selection
        const newSelections = selectedDocuments.filter((_, index) => index !== existingIndex);
        onSelectionChange(newSelections);
      } else {
        // Add new selection with next available order
        const usedOrders = new Set(selectedDocuments.map(s => s.order));
        let nextOrder = 1;
        while (usedOrders.has(nextOrder)) {
          nextOrder++;
        }
        const newSelections = [...selectedDocuments, { item, order: nextOrder }];
        onSelectionChange(newSelections);
      }
      setCursorRowId(item.id);
      setCursorIndex(itemIndex !== -1 ? itemIndex : 0);
      setRangeAnchor(itemIndex !== -1 ? itemIndex : 0);
    } else if (event?.shiftKey && rangeAnchor !== -1) {
      // Shift+Click: Range selection
      event.preventDefault();
      if (itemIndex !== -1) {
        handleRangeSelection(rangeAnchor, itemIndex);
        setCursorRowId(item.id);
        setCursorIndex(itemIndex);
      }
    } else {
      // Regular click: Single selection
      if (existingIndex >= 0) {
        onSelectionChange([]);
      } else {
        onSelectionChange([{ item, order: 1 }]);
      }
      setCursorRowId(item.id);
      setCursorIndex(itemIndex !== -1 ? itemIndex : 0);
      setRangeAnchor(itemIndex !== -1 ? itemIndex : 0);
    }
  }, [selectedDocuments, rangeAnchor, onSelectionChange, getVisibleDocuments]);

  const toggleFolderSelection = useCallback((folderNode: RowNode, childFiles: DocumentFile[]) => {
    const childFileIds = new Set(childFiles.map(f => f.id));

    // Find which of the currently selected files are children of this folder
    const selectedChildren = selectedDocuments.filter(sel => childFileIds.has(sel.item.id));

    // If all or some children are selected, the action is to deselect them all.
    // Otherwise (if no children are selected), the action is to select them all.
    if (selectedChildren.length > 0) {
      // DESELECT: Filter out all files that belong to this folder
      const newSelections = selectedDocuments.filter(sel => !childFileIds.has(sel.item.id));
      onSelectionChange(newSelections);
    } else {
      // SELECT: Add all children from this folder to the selection
      // First, take the selections that are NOT in the current folder
      const existingSelections = selectedDocuments.filter(sel => !childFileIds.has(sel.item.id));

      // Create new selections for the folder's children, starting the order number
      // after the existing selections.
      const newChildSelections = childFiles.map((file, index) => ({
        item: file,
        order: existingSelections.length + index + 1
      }));

      onSelectionChange([...existingSelections, ...newChildSelections]);
    }
  }, [selectedDocuments, onSelectionChange]);   

  // Range selection with chronological order
  const handleRangeSelection = useCallback((startIndex: number, endIndex: number) => {
    const visibleDocs = getVisibleDocuments();
    
    // Clear all existing selections first
    selectedDocuments.forEach(selection => {
      // We'll replace all selections with the new range
    });

    // Determine selection direction and create chronological order
    const selectionDirection = endIndex > startIndex ? 'down' : 'up';
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    // Create selection array based on chronological order of selection
    const documentsToSelect: DocumentFile[] = [];
    
    if (selectionDirection === 'down') {
      // Selecting downward: start gets 1, next gets 2, etc.
      for (let i = start; i <= end; i++) {
        const doc = visibleDocs[i];
        if (doc) {
          documentsToSelect.push(doc);
        }
      }
    } else {
      // Selecting upward: start gets 1, previous gets 2, etc.
      for (let i = end; i >= start; i--) {
        const doc = visibleDocs[i];
        if (doc) {
          documentsToSelect.push(doc);
        }
      }
    }
    
    // Apply selections in chronological order
    const newSelections = documentsToSelect.map((doc, index) => ({
      item: doc,
      order: index + 1
    }));
    
    onSelectionChange(newSelections);
  }, [getVisibleDocuments, selectedDocuments, onSelectionChange]);

  const selectAll = useCallback(() => {
    if (!gridApi) return;
    
    const allItems: DocumentFile[] = [];
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data && !node.group) {
        allItems.push(node.data);
      }
    });
    
    const newSelections = allItems.map((item, index) => ({
      item,
      order: index + 1
    }));
    
    onSelectionChange(newSelections);
    setRangeAnchor(0);
  }, [gridApi, onSelectionChange]);

  const clearAllSelections = useCallback(() => {
    onSelectionChange([]);
    setRangeAnchor(-1);
  }, [onSelectionChange]);

  // Clear cursor and selections when filtered documents change (i.e., when mappings are created)
  useEffect(() => {
    // Clear selections that are no longer available
    const availableIds = new Set(availableDocuments.map(doc => doc.id));
    const validSelections = selectedDocuments.filter(sel => availableIds.has(sel.item.id));
    
    if (validSelections.length !== selectedDocuments.length) {
      onSelectionChange(validSelections);
    }
    
    // Clear cursor if it's no longer available
    if (cursorRowId && !availableIds.has(cursorRowId)) {
      setCursorRowId(availableDocuments[0]?.id || null);
    }
  }, [availableDocuments, selectedDocuments, cursorRowId, onSelectionChange]);

  // Table view column definitions
  const tableColumnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '',
      field: 'select',
      width: 80,
      pinned: 'left',
      sortable: false,
      filter: false,
      cellRenderer: SelectionCellRenderer,
      cellStyle: { padding: '0' }
    },
    {
      headerName: 'File',
      field: 'filePath',
      flex: 2,
      cellRenderer: FilePathCellRenderer,
      filter: 'agTextColumnFilter',
      sortable: true,
      comparator: naturalComparator,
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith'],
        debounceMs: 500,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true,
      floatingFilterComponentParams: {
        debounceMs: 500
      }
    },
    {
      headerName: 'File Name',
      field: 'fileName',
      flex: 1,
      filter: 'agTextColumnFilter',
      sortable: true,
      comparator: naturalComparator,
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith'],
        debounceMs: 500,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true
    },
    {
      headerName: 'Type',
      field: 'fileType',
      width: 100,
      filter: 'agSetColumnFilter',
      sortable: true,
      comparator: naturalComparator,
      filterParams: {
        values: ['pdf', 'docx', 'xlsx', 'jpg', 'png'],
        refreshValuesOnOpen: true
      },
      floatingFilter: true
    },
    {
      headerName: 'Size',
      field: 'fileSize',
      width: 120,
      cellRenderer: FileSizeCellRenderer,
      filter: 'agNumberColumnFilter',
      sortable: true,
      filterParams: {
        debounceMs: 500
      },
      floatingFilter: true,
      comparator: (valueA: number, valueB: number) => valueA - valueB
    },
    {
      headerName: 'Modified',
      field: 'dateModified',
      width: 130,
      filter: 'agDateColumnFilter',
      sortable: true,
      comparator: naturalComparator,
      filterParams: {
        debounceMs: 500
      },
      floatingFilter: true
    }
  ], [naturalComparator]);

  // Tree view column definitions
  const treeColumnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '',
      field: 'select',
      width: 80,
      pinned: 'left',
      sortable: false,
      filter: false,
      cellRenderer: SelectionCellRenderer,
      cellStyle: { padding: '0' }
    },
    {
      headerName: 'Name',
      field: 'fileName',
      flex: 2,
      cellRenderer: 'agGroupCellRenderer',
      filter: 'agTextColumnFilter',
      sortable: true,
      comparator: naturalComparator,
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith'],
        debounceMs: 500,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true
    },
    {
      headerName: 'Type',
      field: 'fileType',
      width: 100,
      filter: 'agSetColumnFilter',
      sortable: true,
      comparator: naturalComparator,
      filterParams: {
        values: ['pdf', 'docx', 'xlsx', 'jpg', 'png'],
        refreshValuesOnOpen: true
      },
      floatingFilter: true,
      valueGetter: (params) => {
        return params.node?.group ? 'folder' : params.data?.fileType;
      }
    },
    {
      headerName: 'Size',
      field: 'fileSize',
      width: 120,
      cellRenderer: FileSizeCellRenderer,
      filter: 'agNumberColumnFilter',
      sortable: true,
      filterParams: {
        debounceMs: 500
      },
      floatingFilter: true
    },
    {
      headerName: 'Modified',
      field: 'dateModified',
      width: 130,
      filter: 'agDateColumnFilter',
      sortable: true,
      comparator: naturalComparator,
      filterParams: {
        debounceMs: 500
      },
      floatingFilter: true
    }
  ], [naturalComparator]);

  // Auto group column definition
  const autoGroupColumnDef = useMemo(() => ({
    headerName: 'Path',
    cellRenderer: AutoGroupCellRenderer,
    cellRendererParams: {
      suppressCount: true,
    },
    minWidth: 250,
    flex: 1
  }), []);

  // Grid options
  const gridOptions = useMemo(() => ({
    suppressRowClickSelection: true,
    treeData: viewMode === 'tree',
    getDataPath: viewMode === 'tree' ? (data: TreeDataFile) => {
      return [...data.folderHierarchy, data.fileName];
    } : undefined,
    autoGroupColumnDef: viewMode === 'tree' ? autoGroupColumnDef : undefined,
    groupDefaultExpanded: viewMode === 'tree' ? 1 : undefined,
    rowBuffer: 10,
    suppressRowVirtualisation: false,
    cacheQuickFilter: true,
    debounceVerticalScrollbar: true,
    animateRows: viewMode === 'tree',
    suppressColumnMoveAnimation: true,
    enableAdvancedFilter: false,
    floatingFilter: true,
    defaultColDef: {
      sortable: true,
      resizable: true,
      filter: true
    },
    getRowId: (params: any) => params.data.id,
    enableCellTextSelection: true
  }), [viewMode, autoGroupColumnDef]);

  // Get current column definitions based on view mode
  const currentColumnDefs = useMemo(() => {
    return viewMode === 'tree' ? treeColumnDefs : tableColumnDefs;
  }, [viewMode, treeColumnDefs, tableColumnDefs]);

  // Update grid context when state changes
  useEffect(() => {
    if (gridApi) {
      const newContext = {
        selectedFiles: selectedDocuments,
        cursorRowId,
        onToggleSelection: toggleSelection,
        onToggleFolderSelection: toggleFolderSelection,
        viewMode
      };

      gridApi.setGridOption('context', newContext);

      // Force immediate refresh of all cells to update visual state
      gridApi.refreshCells({
        force: true
      });
    }
  }, [gridApi, selectedDocuments, cursorRowId, toggleSelection, toggleFolderSelection, viewMode]);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);

    if (availableDocuments.length > 0) {
      setCursorRowId(availableDocuments[0].id);
    }

    const initialContext = {
      selectedFiles: selectedDocuments,
      cursorRowId: availableDocuments[0]?.id || null,
      onToggleSelection: toggleSelection,
      onToggleFolderSelection: toggleFolderSelection,
      viewMode
    };

    params.api.setGridOption('context', initialContext);
  }, [availableDocuments, selectedDocuments, toggleSelection, toggleFolderSelection, viewMode]);

  // Handle cell clicks
  const onCellClicked = useCallback((event: CellClickedEvent) => {
    if (event.colDef.field === 'select') {
      return;
    }

    if (event.node.group) {
      return;
    }

    const document = event.data;
    if (!document) return;

    const visibleDocs = getVisibleDocuments();
    const clickIndex = visibleDocs.findIndex(doc => doc.id === document.id);
    
    if (clickIndex === -1) return;

    if (event.event?.ctrlKey || event.event?.metaKey) {
      // Ctrl+Click: Toggle selection
      toggleSelection(document, event.event as React.MouseEvent);
    } else if (event.event?.shiftKey && rangeAnchor !== -1) {
      // Shift+Click: Range selection
      handleRangeSelection(rangeAnchor, clickIndex);
      setCursorRowId(document.id);
      setCursorIndex(clickIndex);
    } else {
      // Regular click: Update cursor
      setCursorRowId(document.id);
      setCursorIndex(clickIndex);
    }
  }, [toggleSelection, rangeAnchor, handleRangeSelection, getVisibleDocuments]);

  // Handle keyboard events
  const onCellKeyDown = useCallback((event: CellKeyDownEvent) => {
    const { key, ctrlKey, metaKey, shiftKey } = event.event;
    
    if (!gridApi) return;

    const visibleDocs = getVisibleDocuments();
    const currentIndex = getCurrentCursorIndex();
    let handled = false;

    switch (key) {
      case 'ArrowDown':
        if (shiftKey) {
          // Shift+Down: Range selection downward
          event.event.preventDefault();
          if (currentIndex < visibleDocs.length - 1) {
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
          if (currentIndex < visibleDocs.length - 1) {
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
        const currentDoc = visibleDocs[currentIndex];
        if (currentDoc) {
          toggleSelection(currentDoc);
          setRangeAnchor(currentIndex);
        }
        handled = true;
        break;

      case 'Escape':
        // Escape: Clear all selections and reset all states
        event.event.preventDefault();
        if (selectedDocuments.length > 0) {
          // Step 1: Clear ALL state immediately
          const targetCursor = visibleDocs[0]?.id || null;
          
          setCursorRowId(null);  // Force clear cursor
          setRangeAnchor(-1);
          clearAllSelections();      // Clear selections
          
          // Step 2: Force complete grid refresh
          setTimeout(() => {
            if (gridApi) {
              gridApi.refreshCells({ force: true, suppressFlash: false });
              gridApi.redrawRows();
              
              // Step 3: Set single cursor after everything is cleared
              setTimeout(() => {
                setCursorRowId(targetCursor);
                
                if (targetCursor) {
                  const newIndex = visibleDocs.findIndex(doc => doc.id === targetCursor);
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
          selectAll();
          setRangeAnchor(0);
          handled = true;
        }
        break;

      case 'Enter':
        // Enter: Confirm mapping if valid
        event.event.preventDefault();
        if (canConfirmMapping) {
          onConfirmMapping();
        }
        handled = true;
        break;
    }

    if (handled) {
      event.event.stopPropagation();
    }
  }, [gridApi, getCurrentCursorIndex, getVisibleDocuments, getRowIdFromIndex, rangeAnchor, handleRangeSelection, toggleSelection, clearAllSelections, selectedDocuments, selectAll, onConfirmMapping]);

  // Clear states when selections are cleared externally
  useEffect(() => {
    if (selectedDocuments.length === 0) {
      setRangeAnchor(-1);
      
      // Only reset cursor if we're not already in a clearing operation
      if (gridApi && cursorRowId) {
        // Determine target cursor position
        const targetCursor = availableDocuments[0]?.id || null;
        
        // Only update if different from current
        if (targetCursor && targetCursor !== cursorRowId) {
          setCursorRowId(targetCursor);
          const visibleDocs = getVisibleDocuments();
          const index = visibleDocs.findIndex(doc => doc.id === targetCursor);
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
  }, [selectedDocuments.length, gridApi, cursorRowId, availableDocuments, getVisibleDocuments]);

  // Handle global search
  const handleGlobalSearch = useCallback((searchValue: string) => {
    if (!gridApi) return;

    const filterModel = AGGridSearchParser.createFilterModel(searchValue, {
      pathField: 'filePath',
      fileNameField: 'fileName'
    });
    const sortModel = AGGridSearchParser.createSortModel(searchValue, 'fileName');

    gridApi.setFilterModel(filterModel);
    
    if (sortModel.length > 0) {
      gridApi.applyColumnState({
        state: [{
          colId: 'fileName',
          sort: 'asc'
        }],
        defaultState: { sort: null }
      });
    } else {
      gridApi.applyColumnState({
        state: [],
        defaultState: { sort: null }
      });
    }
  }, [gridApi]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleGlobalSearch(globalSearch);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [globalSearch, handleGlobalSearch]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    if (!gridApi) return;
    gridApi.setFilterModel({});
    gridApi.applyColumnState({
      state: [],
      defaultState: { sort: null }
    });
    setGlobalSearch('');
  }, [gridApi]);

  // View mode toggle
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'table' ? 'tree' : 'table');
  }, []);

  // Validation logic
  const canConfirmMapping = useMemo(() => {
    if (currentReferences.length === 0) return false;
    if (selectedDocuments.length === 0) return false;
    
    // For bulk mapping, number of documents should match references
    if (currentReferences.length > 1) {
      return selectedDocuments.length === currentReferences.length;
    }
    
    // For single mapping, exactly one document should be selected
    return selectedDocuments.length === 1;
  }, [currentReferences.length, selectedDocuments.length]);

  // Get search hint text
  const getSearchHint = () => {
    return AGGridSearchParser.getSearchHint(globalSearch);
  };

  // NEW: Get count of filtered documents vs total
  const documentCounts = useMemo(() => {
    const total = documentFiles.length;
    const available = availableDocuments.length;
    const mapped = total - available;
    return { total, available, mapped };
  }, [documentFiles.length, availableDocuments.length]);

  return (
    <div className="w-full h-full flex flex-col bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" tabIndex={0}>
      {/* Header */}
      <div className="p-2 border-b bg-gray-50">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search documents... (use / for path/filename)"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-10 pr-10"
            />
            {/* Search help icon with tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-help">
                    <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p className="text-sm">{getSearchHint()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <Button
            variant="outline"
            onClick={toggleViewMode}
            className="flex items-center gap-2"
          >
            {viewMode === 'table' ? (
              <>
                <TreePine className="h-4 w-4" />
                Tree View
              </>
            ) : (
              <>
                <Table className="h-4 w-4" />
                Table View
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={clearAllFilters}
          >
            Clear All
          </Button>
        </div>
        
        {/* Selection summary and actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={clearAllSelections}
              className="text-xs"
              disabled={selectedDocuments.length === 0}
            >
              ✕ Clear ({selectedDocuments.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={selectAll}
              className="text-xs"
            >
              📄 Select All Visible
            </Button>
          </div>
          
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              {documentCounts.available} Available
            </Badge>
            {documentCounts.mapped > 0 && (
              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
                {documentCounts.mapped} Mapped
              </Badge>
            )}
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              {documentCounts.total} Total
            </Badge>
          </div>
          
          <Button
            onClick={onConfirmMapping}
            disabled={!canConfirmMapping}
            className={`${
              canConfirmMapping
                ? 'bg-emerald-700 hover:bg-emerald-600'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            ✓ Confirm Mapping
            {currentReferences.length > 1 && (
              <Badge className="ml-2 bg-white/20 text-white">
                {selectedDocuments.length}/{currentReferences.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Keyboard Instructions */}
        <div className="bg-blue-50 border-t border-blue-200 mt-2 p-2 text-xs text-blue-700">
          <div className="grid grid-cols-2 gap-2">
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
            <span>
              <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Ctrl+A</kbd> select all
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-800">Enter</kbd> confirm
            </span>
          </div>
        </div>
      </div>

      {/* AG Grid */}
      <div className="flex-1 ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          rowData={displayData}
          columnDefs={currentColumnDefs}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
          onCellClicked={onCellClicked}
          onCellKeyDown={onCellKeyDown}
          suppressMenuHide={true}
          enableCellTextSelection={false}
          treeData={viewMode === 'tree'}
          groupDefaultExpanded={-1}
          getDataPath={(data) => data.filePath.split("/").slice(1)}
          theme="legacy"
        />
      </div>

      {/* Selection Details */}
      {selectedDocuments.length > 0 && (
        <div className="p-2 border-t bg-gray-50 max-h-32 overflow-y-auto">
          <h3 className="font-medium mb-2 text-sm">
            Selected Files ({selectedDocuments.length}):
          </h3>
          <div className="space-y-1">
            {selectedDocuments
              .sort((a, b) => a.order - b.order)
              .map((selection) => (
                <div key={selection.item.id} className="text-sm flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  >
                    {selection.order}
                  </Badge>
                  <span className="font-medium">{selection.item.fileName}</span>
                  <span className="text-gray-500 text-xs truncate">{selection.item.filePath}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};