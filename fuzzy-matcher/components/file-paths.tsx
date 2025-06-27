// components/file-paths.tsx - Enhanced with AG Grid
'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Settings, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import required AG Grid modules
import { ModuleRegistry } from 'ag-grid-community'; 
import { AllEnterpriseModule } from 'ag-grid-enterprise';

// Register all Community and Enterprise features
ModuleRegistry.registerModules([AllEnterpriseModule]);

import { 
  ColDef, 
  GridReadyEvent, 
  GridApi, 
  ITextFilterParams
} from 'ag-grid-community';

// Import styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface FilePathsProps {
  filePaths: string[];
  selectedFilePaths: Array<{ item: string; order: number }>;
  currentSearch: string;
  onSelectFilePath: (path: string) => void;
  onToggleSelection: (path: string) => void;
  onSelectAll: () => void;
  onBulkDeselect: () => void;
  onDetectMatches: () => void;
}

interface FilePathData {
  id: string;
  filePath: string;
  fileName: string;
  directory: string;
  fileExtension: string;
  depth: number;
}

// Global search parser for slash delimiter logic
class FilePathSearchParser {
  static parseSearchInput(input: string): {
    pathQuery?: string;
    fileNameQuery?: string;
    hasWildcard: boolean;
    sortByFileName: boolean;
  } {
    if (!input.trim()) {
      return { hasWildcard: false, sortByFileName: false };
    }

    const hasWildcard = input.includes('*');
    const cleanInput = input.replace(/\*/g, '').trim();

    if (cleanInput.includes('/')) {
      const [pathPart, fileNamePart] = cleanInput.split('/', 2);
      return {
        pathQuery: pathPart.trim() || undefined,
        fileNameQuery: fileNamePart.trim() || undefined,
        hasWildcard,
        sortByFileName: hasWildcard
      };
    }

    // Default: search file name only
    return {
      fileNameQuery: cleanInput,
      hasWildcard,
      sortByFileName: hasWildcard
    };
  }

  static createFilterModel(searchInput: string): any {
    const parsed = this.parseSearchInput(searchInput);
    const filterModel: any = {};

    if (parsed.pathQuery) {
      filterModel.directory = {
        filterType: 'text',
        type: 'contains',
        filter: parsed.pathQuery
      };
    }

    if (parsed.fileNameQuery) {
      filterModel.fileName = {
        filterType: 'text',
        type: 'contains',
        filter: parsed.fileNameQuery
      };
    }

    return filterModel;
  }

  static createSortModel(searchInput: string): any[] {
    const parsed = this.parseSearchInput(searchInput);
    
    if (parsed.sortByFileName) {
      return [{ colId: 'fileName', sort: 'asc' }];
    }

    return [];
  }
}

// Convert file paths to structured data
const processFilePaths = (filePaths: string[]): FilePathData[] => {
  return filePaths.map((filePath, index) => {
    const parts = filePath.split('/').filter(part => part.length > 0);
    const fileName = parts[parts.length - 1] || filePath;
    const directory = parts.slice(0, -1).join('/');
    const extensionMatch = fileName.match(/\.([^.]+)$/);
    const fileExtension = extensionMatch ? extensionMatch[1].toLowerCase() : '';

    return {
      id: `file-${index}`,
      filePath,
      fileName,
      directory: directory ? `/${directory}` : '/',
      fileExtension,
      depth: parts.length - 1
    };
  });
};

// Custom cell renderers
const SelectionCellRenderer = (props: any) => {
  const { data, onToggleSelection, selectedPaths, getSelectionOrder } = props;
  const isSelected = selectedPaths.some((item: any) => item.item === data.filePath);
  const order = getSelectionOrder(data.filePath);

  const handleToggle = () => {
    onToggleSelection(data.filePath);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleToggle}
        className="rounded"
      />
      {isSelected && order && (
        <Badge variant="secondary" className="bg-emerald-600 text-white text-xs">
          {order}
        </Badge>
      )}
    </div>
  );
};

const FilePathCellRenderer = (props: any) => {
  const { data } = props;
  
  return (
    <div className="flex flex-col py-1">
      {data.directory !== '/' && (
        <span className="text-xs text-gray-500 font-mono">
          {data.directory}/
        </span>
      )}
      <span className="font-medium text-sm">{data.fileName}</span>
    </div>
  );
};

const DepthCellRenderer = (props: any) => {
  const { value } = props;
  const dots = '•'.repeat(Math.min(value, 5));
  
  return (
    <div className="flex items-center">
      <span className="text-gray-400 font-mono text-xs">
        {dots}
      </span>
      <span className="ml-2 text-xs text-gray-500">
        {value}
      </span>
    </div>
  );
};

export function FilePaths({
  filePaths,
  selectedFilePaths,
  currentSearch: initialSearch,
  onSelectFilePath,
  onToggleSelection,
  onSelectAll,
  onBulkDeselect,
  onDetectMatches
}: FilePathsProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [globalSearch, setGlobalSearch] = useState<string>(initialSearch || '');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Process file paths data
  const rowData = useMemo(() => processFilePaths(filePaths), [filePaths]);

  // Get selection order
  const getSelectionOrder = useCallback((filePath: string): number | null => {
    const found = selectedFilePaths.find(item => item.item === filePath);
    return found ? found.order : null;
  }, [selectedFilePaths]);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Select',
      field: 'select',
      width: 100,
      cellRenderer: SelectionCellRenderer,
      cellRendererParams: {
        onToggleSelection,
        selectedPaths: selectedFilePaths,
        getSelectionOrder
      },
      sortable: false,
      filter: false,
      pinned: 'left'
    },
    {
      headerName: 'File Path',
      field: 'filePath',
      flex: 2,
      cellRenderer: FilePathCellRenderer,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith'],
        debounceMs: 300,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true,
      floatingFilterComponentParams: {
        debounceMs: 400
      }
    },
    {
      headerName: 'File Name',
      field: 'fileName',
      flex: 1,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith'],
        debounceMs: 300,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true,
      floatingFilterComponentParams: {
        debounceMs: 400
      }
    },
    {
      headerName: 'Directory',
      field: 'directory',
      flex: 1,
      filter: 'agTextColumnFilter',
      filterParams: {
        filterOptions: ['contains', 'startsWith', 'endsWith'],
        debounceMs: 300,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true,
      floatingFilterComponentParams: {
        debounceMs: 400
      }
    },
    {
      headerName: 'Type',
      field: 'fileExtension',
      width: 100,
      filter: 'agSetColumnFilter',
      filterParams: {
        refreshValuesOnOpen: true
      },
      floatingFilter: true
    },
    {
      headerName: 'Depth',
      field: 'depth',
      width: 100,
      cellRenderer: DepthCellRenderer,
      filter: 'agNumberColumnFilter',
      filterParams: {
        debounceMs: 300
      },
      floatingFilter: true
    }
  ], [selectedFilePaths, onToggleSelection, getSelectionOrder]);

  // Grid options
  const gridOptions = useMemo(() => ({
    rowSelection: 'multiple' as const,
    suppressRowDeselection: false,
    rowMultiSelectWithClick: false, // Disable to prevent interference with custom selection
    
    // Performance optimizations
    rowBuffer: 10,
    suppressRowVirtualisation: false,
    cacheQuickFilter: true,
    debounceVerticalScrollbar: true,
    animateRows: false,
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
    }
  }), []);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Handle global search
  const handleGlobalSearch = useCallback((searchValue: string) => {
    if (!gridApi) return;

    const filterModel = FilePathSearchParser.createFilterModel(searchValue);
    const sortModel = FilePathSearchParser.createSortModel(searchValue);

    // Apply filter model
    gridApi.setFilterModel(filterModel);
    
    // Apply sort model if wildcard is present using applyColumnState
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
  const showAdvancedFilter = useCallback(() => {
    if (!gridApi) return;
    
    // Enable advanced filter first
    gridApi.setGridOption('enableAdvancedFilter', true);
    
    // Then show the builder
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
    // Use applyColumnState for sorting in newer versions
    gridApi.applyColumnState({
      state: [],
      defaultState: { sort: null }
    });
    setGlobalSearch('');
  }, [gridApi]);

  // Get search hint text
  const getSearchHint = () => {
    if (!globalSearch) {
      return 'Types to search file names, use "/" for directory/filename (e.g., "documents/agreement")';
    }
    
    const parsed = FilePathSearchParser.parseSearchInput(globalSearch);
    const hints: string[] = [];
    
    if (parsed.pathQuery) {
      hints.push(`Directory contains "${parsed.pathQuery}"`);
    }
    if (parsed.fileNameQuery) {
      hints.push(`Filename contains "${parsed.fileNameQuery}"`);
    }
    if (parsed.sortByFileName) {
      hints.push('Sorted by filename');
    }
    
    return hints.join(' AND ');
  };

  const selectedCount = selectedFilePaths.length;
  const totalCount = filePaths.length;

  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="bg-blue-700 text-white p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              File Path Selector
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Select matching file paths from document dump
            </p>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white">
            {selectedCount} of {totalCount}
          </Badge>
        </div>
      </div>

      {/* Global Search and Controls */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search file paths... (use / for directory/filename)"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={showAdvancedFilter}
            className="flex items-center gap-2"
            size="sm"
          >
            <Settings className="h-4 w-4" />
            Advanced
          </Button>
          <Button
            variant="outline"
            onClick={clearAllFilters}
            size="sm"
          >
            Clear
          </Button>
        </div>
        
        {/* Search hint */}
        <div className="text-xs text-gray-600 mb-3">
          {getSearchHint()}
        </div>

        {/* Bulk Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onSelectAll}>
            Select All
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkDeselect}>
            Clear Selection
          </Button>
          <Button size="sm" variant="outline" onClick={onDetectMatches}>
            Detect Matches
          </Button>
        </div>
      </div>

      {/* AG Grid */}
      <div className="flex-1 ag-theme-alpine min-h-0">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
          suppressMenuHide={true}
          enableCellTextSelection={true}
          theme="legacy"
        />
      </div>

      {/* Selection Summary */}
      {selectedCount > 0 && (
        <div className="p-3 border-t bg-gray-50">
          <div className="text-sm text-gray-700">
            <strong>{selectedCount}</strong> file{selectedCount !== 1 ? 's' : ''} selected
            {selectedCount > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                • Use selection order for matching
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}