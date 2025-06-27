// components/new-document-selector.tsx
'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Settings, Table, TreePine } from 'lucide-react';
import { FileReference } from '@/lib/types';

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
} from 'ag-grid-community';

// Import styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { AGGridSearchParser } from '@/lib/ag-grid-search-utils';

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
  const { selectedFiles, cursorRowId, onToggleSelection, viewMode } = gridContext || {};
  
  // Handle folder nodes (groups) in tree view
  if (node.group && viewMode === 'tree') {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="w-4 h-4 border-2 border-gray-300 rounded opacity-50"></div>
      </div>
    );
  }
  
  // Handle file nodes
  if (!data) return null;
  
  // Find if this item is selected
  const selection = selectedFiles?.find((sel: OrderedSelection) => sel.item.id === data.id);
  const isSelected = !!selection;
  const isCursor = data.id === cursorRowId;
  const orderNumber = selection?.order;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(data, e);
    }
  };
  
  return (
    <div 
      className={`
        flex items-center justify-center h-full w-full cursor-pointer relative
        ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
        ${isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'}
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
  const isCursor = data.id === cursorRowId;
  
  return (
    <div className={`flex flex-col relative ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
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
  
  const isCursor = data && data.id === cursorRowId;
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
    <div className={`flex items-center gap-2 relative ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
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
  onConfirmMapping
}) => {
  const gridRef = useRef<AgGridReact>(null);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cursorRowId, setCursorRowId] = useState<string | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);

  // Transform data based on view mode
  const displayData = useMemo(() => {
    if (viewMode === 'tree') {
      return buildTreeData(documentFiles);
    }
    return documentFiles;
  }, [documentFiles, viewMode]);

  // Selection management functions
  const toggleSelection = useCallback((item: DocumentFile, event?: React.MouseEvent) => {
    console.log('Toggle selection called for:', item.id, 'Current selections:', selectedDocuments.length);
    
    const existingIndex = selectedDocuments.findIndex(sel => sel.item.id === item.id);
    
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
      setRangeAnchor(item.id);
    } else if (event?.shiftKey && rangeAnchor) {
      // Shift+Click: Range selection
      handleRangeSelection(rangeAnchor, item.id);
      setCursorRowId(item.id);
    } else {
      // Regular click: Single selection
      if (existingIndex >= 0) {
        onSelectionChange([]);
      } else {
        onSelectionChange([{ item, order: 1 }]);
      }
      setCursorRowId(item.id);
      setRangeAnchor(item.id);
    }
  }, [selectedDocuments, rangeAnchor, onSelectionChange]);

  // Range selection with chronological order
  const handleRangeSelection = useCallback((startId: string, endId: string) => {
    if (!gridApi) return;
    
    // Get all displayed (filtered) row nodes - only files, not folders
    const allNodes: any[] = [];
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data && !node.group) {
        allNodes.push(node);
      }
    });
    
    const startIndex = allNodes.findIndex(node => node.data.id === startId);
    const endIndex = allNodes.findIndex(node => node.data.id === endId);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    const selectionDirection = endIndex > startIndex ? 'down' : 'up';
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    // Create selection array based on chronological order of selection
    const newSelections: OrderedSelection[] = [];
    
    if (selectionDirection === 'down') {
      // Selecting downward: start gets 1, next gets 2, etc.
      for (let i = minIndex; i <= maxIndex; i++) {
        const orderNumber = (i - minIndex) + 1;
        newSelections.push({
          item: allNodes[i].data,
          order: orderNumber
        });
      }
    } else {
      // Selecting upward: start gets 1, previous gets 2, etc.
      for (let i = maxIndex; i >= minIndex; i--) {
        const orderNumber = (maxIndex - i) + 1;
        newSelections.push({
          item: allNodes[i].data,
          order: orderNumber
        });
      }
    }
    
    onSelectionChange(newSelections);
  }, [gridApi, onSelectionChange]);

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
    setRangeAnchor(allItems[0]?.id || null);
  }, [gridApi, onSelectionChange]);

  const clearAllSelections = useCallback(() => {
    onSelectionChange([]);
    setRangeAnchor(null);
  }, [onSelectionChange]);

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
      filterParams: {
        debounceMs: 500
      },
      floatingFilter: true
    }
  ], []);

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
      filterParams: {
        debounceMs: 500
      },
      floatingFilter: true
    }
  ], []);

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

  // Update grid context when selection state changes
  useEffect(() => {
    if (gridApi) {
      const newContext = {
        selectedFiles: selectedDocuments,
        cursorRowId,
        onToggleSelection: toggleSelection,
        viewMode
      };
      
      gridApi.setGridOption('context', newContext);
      
      // Force immediate refresh of the selection column
      setTimeout(() => {
        gridApi.refreshCells({
          columns: ['select'],
          force: true
        });
      }, 0);
    }
  }, [gridApi, selectedDocuments, cursorRowId, toggleSelection, viewMode]);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    
    if (documentFiles.length > 0) {
      setCursorRowId(documentFiles[0].id);
    }
    
    const initialContext = {
      selectedFiles: selectedDocuments,
      cursorRowId: documentFiles[0]?.id || null,
      onToggleSelection: toggleSelection,
      viewMode
    };
    
    params.api.setGridOption('context', initialContext);
  }, [documentFiles, selectedDocuments, toggleSelection, viewMode]);

  // Handle cell clicks
  const onCellClicked = useCallback((event: CellClickedEvent) => {
    if (event.colDef.field === 'select') {
      return;
    }
    
    if (event.node.group) {
      return;
    }
    
    setCursorRowId(event.data.id);
  }, []);

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

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search documents... (use / for path/filename)"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-10"
            />
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
        
        {/* Search hint */}
        <div className="text-xs text-gray-600 mb-2">
          {getSearchHint()}
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
        <div className="p-4 border-t bg-gray-50 max-h-32 overflow-y-auto">
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