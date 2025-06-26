// fuzzy-matcher/components/document-selector.tsx
'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Settings, Table, TreePine } from 'lucide-react';

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

import { AGGridSearchParser } from '@/lib/ag-grid-search-utils';

// Sample data generator with stable, unique IDs
const generateSampleData = (): DocumentFile[] => {
  const sampleFiles = [
    { path: '/contracts/legal/service-agreement-2024.pdf', type: 'pdf', size: 1024000 },
    { path: '/contracts/legal/nda-template.docx', type: 'docx', size: 512000 },
    { path: '/contracts/vendor/software-license.pdf', type: 'pdf', size: 768000 },
    { path: '/exhibits/evidence/witness-statement-1.pdf', type: 'pdf', size: 2048000 },
    { path: '/exhibits/evidence/witness-statement-2.pdf', type: 'pdf', size: 1536000 },
    { path: '/exhibits/photos/accident-scene.jpg', type: 'jpg', size: 3072000 },
    { path: '/exhibits/photos/damage-assessment.jpg', type: 'jpg', size: 2560000 },
    { path: '/reports/financial/quarterly-report-q1.xlsx', type: 'xlsx', size: 768000 },
    { path: '/reports/financial/quarterly-report-q2.xlsx', type: 'xlsx', size: 832000 },
    { path: '/reports/technical/system-analysis.docx', type: 'docx', size: 1024000 },
    { path: '/correspondence/client/agreement-draft.docx', type: 'docx', size: 256000 },
    { path: '/correspondence/client/agreement-final.pdf', type: 'pdf', size: 1280000 },
    { path: '/correspondence/vendor/proposal-request.pdf', type: 'pdf', size: 640000 },
    { path: '/discovery/documents/exhibit-a-contract.pdf', type: 'pdf', size: 1792000 },
    { path: '/discovery/documents/exhibit-b-correspondence.pdf', type: 'pdf', size: 640000 },
    { path: '/discovery/documents/exhibit-c-financial.xlsx', type: 'xlsx', size: 896000 },
    { path: '/discovery/depositions/witness-a.pdf', type: 'pdf', size: 3200000 },
    { path: '/pleadings/motions/motion-to-dismiss.pdf', type: 'pdf', size: 1152000 },
    { path: '/pleadings/briefs/opening-brief.docx', type: 'docx', size: 2304000 },
    { path: '/transcripts/depositions/witness-deposition-smith.pdf', type: 'pdf', size: 4096000 },
    { path: '/transcripts/hearings/preliminary-hearing.pdf', type: 'pdf', size: 3584000 }
  ];

  return sampleFiles.map((file, index) => {
    const pathParts = file.path.split('/');
    const fileName = pathParts.pop() || '';
    const filePath = file.path;

    // Create stable, unique ID based on file path hash for consistency
    const generateStableId = (path: string): string => {
      let hash = 0;
      for (let i = 0; i < path.length; i++) {
        const char = path.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `doc-${Math.abs(hash)}-${index}`;
    };

    return {
      id: generateStableId(filePath),
      filePath: filePath,
      fileName,
      fileSize: file.size,
      dateModified: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      fileType: file.type
    };
  });
};

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

// Custom Selection Cell Renderer for both views
const SelectionCellRenderer = (props: any) => {
  const { data, node, api } = props;
  
  // Don't show selection for group nodes (folders) in tree view
  if (node.group) return null;
  if (!data) return null;
  
  // Get the current context from the grid API
  const gridContext = api.getGridOption('context');
  const { selectedFiles, cursorRowId, onToggleSelection } = gridContext || {};
  
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
  console.log("props", props)
  const { value, data, api } = props;
  
  // Get the current context from the grid API
  const gridContext = api.getGridOption('context');
  const { cursorRowId } = gridContext || {};
  
  const pathParts = value.split('/').filter((part: string) => part);
  const folders = pathParts.slice(0, -1);
  const isCursor = data.id === cursorRowId;
  
  return (
    <div className={`flex flex-col relative ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
      {/* Cursor indicator */}
      {isCursor && (
        <div></div>
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

export const DocumentSelectorGrid: React.FC = () => {
  const gridRef = useRef<AgGridReact>(null);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Ordered multi-select state
  const [selectedFiles, setSelectedFiles] = useState<OrderedSelection[]>([]);
  const [cursorRowId, setCursorRowId] = useState<string | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);

  // Sample data
  const rowData = useMemo(() => generateSampleData(), []);
  
  // Transform data based on view mode
  const displayData = useMemo(() => {
    if (viewMode === 'tree') {
      return buildTreeData(rowData);
    }
    return rowData;
  }, [rowData, viewMode]);

  // Update multi-select mode based on selections
  useEffect(() => {
    setIsMultiSelectMode(selectedFiles.length > 0);
  }, [selectedFiles.length]);

  // Selection management functions with robust duplicate prevention
  const toggleSelection = useCallback((item: DocumentFile, event?: React.MouseEvent) => {
    console.log('Toggle selection called for:', item.id, 'Current selections:', selectedFiles.length);
    
    const existingIndex = selectedFiles.findIndex(sel => sel.item.id === item.id);
    
    if (event?.ctrlKey || event?.metaKey) {
      // Ctrl+Click: Toggle individual selection
      if (existingIndex >= 0) {
        // Remove existing selection
        setSelectedFiles(prev => {
          const newSelections = prev.filter((_, index) => index !== existingIndex);
          console.log('Removing selection, new count:', newSelections.length);
          return newSelections;
        });
      } else {
        // Add new selection with next available order - ensure no duplicates
        setSelectedFiles(prev => {
          // Double-check for duplicates
          const isDuplicate = prev.some(sel => sel.item.id === item.id);
          if (isDuplicate) {
            console.log('Duplicate selection prevented for:', item.id);
            return prev;
          }
          
          const usedOrders = new Set(prev.map(s => s.order));
          let nextOrder = 1;
          while (usedOrders.has(nextOrder)) {
            nextOrder++;
          }
          const newSelections = [...prev, { item, order: nextOrder }];
          console.log('Adding selection, new count:', newSelections.length);
          return newSelections;
        });
      }
      setCursorRowId(item.id);
      setRangeAnchor(item.id);
    } else if (event?.shiftKey && rangeAnchor) {
      // Shift+Click: Range selection
      handleRangeSelection(rangeAnchor, item.id);
      setCursorRowId(item.id);
    } else {
      // Regular click: Single selection (exit multi-select mode)
      if (isMultiSelectMode) {
        // Clear multi-selections first
        setSelectedFiles([]);
      }
      // Toggle single selection
      if (existingIndex >= 0) {
        setSelectedFiles([]);
        console.log('Clearing single selection');
      } else {
        setSelectedFiles([{ item, order: 1 }]);
        console.log('Setting single selection');
      }
      setCursorRowId(item.id);
      setRangeAnchor(item.id);
    }
  }, [selectedFiles, rangeAnchor, isMultiSelectMode]);

  // Range selection with chronological order based on selection sequence
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
    
    setSelectedFiles(newSelections);
    
    console.log(`Range selection (${selectionDirection}):`, {
      direction: selectionDirection,
      startIndex,
      endIndex,
      chronologicalOrder: newSelections.map(s => ({
        order: s.order,
        fileName: s.item.fileName,
        id: s.item.id.slice(-6)
      }))
    });
  }, [gridApi]);

  const selectAll = useCallback(() => {
    if (!gridApi) return;
    
    const allItems: DocumentFile[] = [];
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data && !node.group) {
        allItems.push(node.data);
      }
    });
    
    // Ensure no duplicates with Set-based deduplication
    const uniqueItems = Array.from(
      new Map(allItems.map(item => [item.id, item])).values()
    );
    
    const newSelections = uniqueItems.map((item, index) => ({
      item,
      order: index + 1
    }));
    
    setSelectedFiles(newSelections);
    setRangeAnchor(uniqueItems[0]?.id || null);
    
    console.log('Select all:', uniqueItems.length, 'unique items');
  }, [gridApi]);

  const clearAllSelections = useCallback(() => {
    setSelectedFiles([]);
    setRangeAnchor(null);
    console.log('Cleared all selections');
  }, []);

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
      floatingFilter: true,
      floatingFilterComponentParams: {
        debounceMs: 500
      }
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

  // Auto group column definition with folder/file icons
  const autoGroupColumnDef = useMemo(() => ({
    headerName: 'Path',
    cellRenderer: AutoGroupCellRenderer,
    cellRendererParams: {
      suppressCount: true,
    },
    minWidth: 250,
    flex: 1
  }), []);

  // Grid options with view-specific configurations
  const gridOptions = useMemo(() => ({
    rowSelection: undefined, // Disable built-in selection
    suppressRowClickSelection: true, // Prevent default row selection
    
    // Tree data specific options
    treeData: viewMode === 'tree',
    getDataPath: viewMode === 'tree' ? (data: TreeDataFile) => {
      return [...data.folderHierarchy, data.fileName];
    } : undefined,
    
    // Auto group column for tree view
    autoGroupColumnDef: viewMode === 'tree' ? autoGroupColumnDef : undefined,
    
    // Expand first level by default in tree view
    groupDefaultExpanded: viewMode === 'tree' ? 1 : undefined,
    
    // Performance optimizations
    rowBuffer: 10,
    suppressRowVirtualisation: false,
    cacheQuickFilter: true,
    debounceVerticalScrollbar: true,
    animateRows: viewMode === 'tree',
    suppressColumnMoveAnimation: true,
    
    // Advanced filtering - disable by default, only show when button clicked
    enableAdvancedFilter: false,
    
    // Floating filters
    floatingFilter: true,
    
    // Default column properties
    defaultColDef: {
      sortable: true,
      resizable: true,
      filter: true
    },

    // Row ID for tracking - essential for proper selection management
    getRowId: (params: any) => params.data.id,
    
    // Enable cell text selection
    enableCellTextSelection: false
  }), [viewMode, autoGroupColumnDef]);

  // Get current column definitions based on view mode
  const currentColumnDefs = useMemo(() => {
    return viewMode === 'tree' ? treeColumnDefs : tableColumnDefs;
  }, [viewMode, treeColumnDefs, tableColumnDefs]);

  // View mode toggle handler
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'table' ? 'tree' : 'table');
  }, []);

  // Fixed keyboard navigation with proper anchor handling
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!gridApi || !cursorRowId) return;

    // Get all displayed nodes (files only)
    const allNodes: any[] = [];
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data && !node.group) {
        allNodes.push(node);
      }
    });

    const currentIndex = allNodes.findIndex(node => node.data.id === cursorRowId);
    if (currentIndex === -1) return;

    let handled = false;

    switch (event.key) {
      case 'ArrowDown':
        if (event.shiftKey) {
          // Shift+Down: Range selection downward
          event.preventDefault();
          if (currentIndex < allNodes.length - 1) {
            const newCursorId = allNodes[currentIndex + 1].data.id;
            
            // Use current cursor as anchor if no anchor is set
            const effectiveAnchor = rangeAnchor || cursorRowId;
            
            // Set anchor if this is the first range selection
            if (!rangeAnchor) {
              setRangeAnchor(cursorRowId);
            }
            
            handleRangeSelection(effectiveAnchor, newCursorId);
            setCursorRowId(newCursorId);
          }
        } else {
          // Down: Move cursor
          event.preventDefault();
          if (currentIndex < allNodes.length - 1) {
            setCursorRowId(allNodes[currentIndex + 1].data.id);
            setRangeAnchor(null); // Clear anchor on navigation
          }
        }
        handled = true;
        break;

      case 'ArrowUp':
        if (event.shiftKey) {
          // Shift+Up: Range selection upward
          event.preventDefault();
          if (currentIndex > 0) {
            const newCursorId = allNodes[currentIndex - 1].data.id;
            
            // Use current cursor as anchor if no anchor is set
            const effectiveAnchor = rangeAnchor || cursorRowId;
            
            // Set anchor if this is the first range selection
            if (!rangeAnchor) {
              setRangeAnchor(cursorRowId);
            }
            
            handleRangeSelection(effectiveAnchor, newCursorId);
            setCursorRowId(newCursorId);
          }
        } else {
          // Up: Move cursor
          event.preventDefault();
          if (currentIndex > 0) {
            setCursorRowId(allNodes[currentIndex - 1].data.id);
            setRangeAnchor(null); // Clear anchor on navigation
          }
        }
        handled = true;
        break;

      case ' ':
        // Space: Toggle selection at cursor
        event.preventDefault();
        const currentItem = allNodes[currentIndex].data;
        if (currentItem) {
          toggleSelection(currentItem);
          setRangeAnchor(cursorRowId);
        }
        handled = true;
        break;

      case 'Escape':
        // Escape: Clear all selections
        event.preventDefault();
        if (isMultiSelectMode) {
          clearAllSelections();
          setRangeAnchor(null);
        }
        handled = true;
        break;

      case 'a':
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+A: Select all
          event.preventDefault();
          selectAll();
          setRangeAnchor(allNodes[0]?.data.id || null);
          handled = true;
        }
        break;
    }

    if (handled) {
      event.stopPropagation();
    }
  }, [cursorRowId, rangeAnchor, gridApi, isMultiSelectMode, toggleSelection, handleRangeSelection, selectAll, clearAllSelections]);

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Update grid context when selection state changes - with immediate refresh
  useEffect(() => {
    if (gridApi) {
      const newContext = {
        selectedFiles,
        cursorRowId,
        onToggleSelection: toggleSelection
      };
      
      gridApi.setGridOption('context', newContext);
      
      // Force immediate refresh of the selection column
      setTimeout(() => {
        gridApi.refreshCells({
          columns: ['select'],
          force: true
        });
      }, 0);
      
      console.log('Updated grid context, selections:', selectedFiles.length);
    }
  }, [gridApi, selectedFiles, cursorRowId, toggleSelection]);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    
    // Set initial cursor and context
    if (rowData.length > 0) {
      setCursorRowId(rowData[0].id);
    }
    
    // Set initial context
    const initialContext = {
      selectedFiles: [],
      cursorRowId: rowData[0]?.id || null,
      onToggleSelection: toggleSelection
    };
    
    params.api.setGridOption('context', initialContext);
    
    console.log('Grid ready, initial context set');
  }, [rowData, toggleSelection]);

  // Handle cell clicks
  const onCellClicked = useCallback((event: CellClickedEvent) => {
    if (event.colDef.field === 'select') {
      // Selection handled by cell renderer
      return;
    }
    
    // Don't set cursor on folder clicks in tree view
    if (event.node.group) {
      return;
    }
    
    // Set cursor to clicked row
    setCursorRowId(event.data.id);
    
    // If not in multi-select mode, clear selections
    if (!isMultiSelectMode && !event.event?.ctrlKey && !event.event?.metaKey && !event.event?.shiftKey) {
      setSelectedFiles([]);
      setRangeAnchor(null);
    }
  }, [isMultiSelectMode]);

  // Handle global search
  const handleGlobalSearch = useCallback((searchValue: string) => {
    if (!gridApi) return;

    console.log('Global search triggered with:', searchValue);
    
    const filterModel = AGGridSearchParser.createFilterModel(searchValue, {
      pathField: 'filePath',
      fileNameField: 'fileName'
    });
    const sortModel = AGGridSearchParser.createSortModel(searchValue, 'fileName');

    console.log('Generated filter model:', filterModel);
    console.log('Generated sort model:', sortModel);

    // Apply filter model
    gridApi.setFilterModel(filterModel);
    
    // Apply sort model if wildcard is present
    if (sortModel.length > 0) {
      gridApi.applyColumnState({
        state: [{
          colId: 'fileName',
          sort: 'asc'
        }],
        defaultState: { sort: null }
      });
    } else {
      // Clear sorting if no wildcard
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

  // Show advanced filter
  const toggleAdvancedFilter = useCallback(() => {
    if (!gridApi) return;
    let currentfilter = gridApi.getGridOption('enableAdvancedFilter');
    gridApi.setGridOption('enableAdvancedFilter', !currentfilter);
    
    setTimeout(() => {
      if (gridApi.showAdvancedFilterBuilder) {
        gridApi.showAdvancedFilterBuilder();
      }
    }, 100);
  }, [gridApi]);

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

  // Get search hint text
  const getSearchHint = () => {
    return AGGridSearchParser.getSearchHint(globalSearch);
  };

  // Get parsed search info for debugging
  const getParsedSearchInfo = () => {
    if (!globalSearch.trim()) return null;
    return AGGridSearchParser.parseSearchInput(globalSearch);
  };

  // Get chronologically ordered selections for display
  const getOrderedSelections = () => {
    return selectedFiles
      .sort((a, b) => a.order - b.order)  // Sort by selection order, not visual position
      .map(selection => selection.item);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Global Search Header */}
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
          
          {/* View Toggle Button */}
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
            onClick={toggleAdvancedFilter}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Advanced
          </Button>
          <Button
            variant="outline"
            onClick={clearAllFilters}
          >
            Clear All
          </Button>
        </div>
        
        {/* View mode indicator */}
        <div className="mb-2 flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-700"
          >
            {viewMode === 'table' ? 'Table View' : 'Tree View'}
          </Badge>
          
          {/* Multi-select mode indicator */}
          {isMultiSelectMode && (
            <Badge
              variant="secondary"
              className="bg-blue-600 text-white text-xs"
            >
              MULTI-SELECT MODE
            </Badge>
          )}
        </div>

        {/* Keyboard Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700 mb-2">
          <div className="flex gap-4">
            <span><kbd>Space</kbd> toggle</span>
            <span><kbd>Shift+↑↓</kbd> range select (chronological order)</span>
            <span><kbd>Ctrl+Click</kbd> multi</span>
            <span><kbd>Shift+Click</kbd> range</span>
            <span><kbd>Esc</kbd> clear</span>
            <span><kbd>Ctrl+A</kbd> select all</span>
          </div>
          <div className="mt-1 text-xs text-blue-600">
            💡 {viewMode === 'tree' ? 'Tree View: Only files can be selected, folders are for organization' : 'Table View: All files can be selected'} | Order numbers reflect selection sequence
          </div>
        </div>
        
        {/* Search hint */}
        <div className="text-xs text-gray-600 mb-1">
          {getSearchHint()}
        </div>
        
        {/* Selection summary */}
        {selectedFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {/* Bulk Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={clearAllSelections}
                className="text-xs"
              >
                ✕ Clear All ({selectedFiles.length})
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
          </div>
        )}
      </div>

      {/* AG Grid */}
      <div className="flex-1 ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          rowData={generateSampleData()}
          columnDefs={currentColumnDefs}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
          onCellClicked={onCellClicked}
          suppressMenuHide={true}
          enableCellTextSelection={false}
          treeData = {viewMode == 'tree'? true:false}
          groupDefaultExpanded={-1}
          getDataPath={(data) =>  data.filePath.split("/").slice(1)}
          theme="legacy"
        />
      </div>

      {/* Selection Details - Chronological Order */}
      {selectedFiles.length > 0 && (
        <div className="p-4 border-t bg-gray-50 max-h-32 overflow-y-auto">
          <h3 className="font-medium mb-2">Selected Files (chronological order):</h3>
          <div className="space-y-1">
            {getOrderedSelections().map((file, index) => {
              const selection = selectedFiles.find(s => s.item.id === file.id);
              return (
                <div key={file.id} className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    >
                      {selection?.order || index + 1}
                    </Badge>
                    <span className="font-medium">{file.fileName}</span>
                    <span className="text-xs text-gray-400">({file.id.slice(-8)})</span>
                  </div>
                  <span className="text-gray-500 text-xs">{file.filePath}</span>
                </div>
              );
            })} 
          </div>
        </div>
      )}
    </div>
  );
};