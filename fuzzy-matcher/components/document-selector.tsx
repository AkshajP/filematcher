// components/document-selector.tsx
'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Settings } from 'lucide-react';

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

interface DocumentFile {
  id: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  dateModified?: string;
  fileType?: string;
}

import { AGGridSearchParser, createDelimiterTextMatcher, createDelimiterFilterOptions } from '@/lib/ag-grid-search-utils';

// Sample data generator
const generateSampleData = (): DocumentFile[] => {
  const sampleFiles = [
    { path: '/contracts/legal/service-agreement-2024.pdf', type: 'pdf', size: 1024000 },
    { path: '/contracts/legal/nda-template.docx', type: 'docx', size: 512000 },
    { path: '/exhibits/evidence/witness-statement-1.pdf', type: 'pdf', size: 2048000 },
    { path: '/exhibits/evidence/witness-statement-2.pdf', type: 'pdf', size: 1536000 },
    { path: '/exhibits/photos/accident-scene.jpg', type: 'jpg', size: 3072000 },
    { path: '/reports/financial/quarterly-report-q1.xlsx', type: 'xlsx', size: 768000 },
    { path: '/reports/financial/quarterly-report-q2.xlsx', type: 'xlsx', size: 832000 },
    { path: '/correspondence/client/agreement-draft.docx', type: 'docx', size: 256000 },
    { path: '/correspondence/client/agreement-final.pdf', type: 'pdf', size: 1280000 },
    { path: '/discovery/documents/exhibit-a-contract.pdf', type: 'pdf', size: 1792000 },
    { path: '/discovery/documents/exhibit-b-correspondence.pdf', type: 'pdf', size: 640000 },
    { path: '/discovery/documents/exhibit-c-financial.xlsx', type: 'xlsx', size: 896000 },
    { path: '/pleadings/motions/motion-to-dismiss.pdf', type: 'pdf', size: 1152000 },
    { path: '/pleadings/briefs/opening-brief.docx', type: 'docx', size: 2304000 },
    { path: '/transcripts/depositions/witness-deposition-smith.pdf', type: 'pdf', size: 4096000 },
    { path: '/transcripts/hearings/preliminary-hearing.pdf', type: 'pdf', size: 3584000 }
  ];

  return sampleFiles.map((file, index) => {
    const pathParts = file.path.split('/');
    const fileName = pathParts.pop() || '';
    const filePath = pathParts.join('/');

    return {
      id: `doc-${index + 1}`,
      filePath: file.path,
      fileName,
      fileSize: file.size,
      dateModified: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      fileType: file.type
    };
  });
};

// Custom cell renderers
const FileSizeCellRenderer = (props: any) => {
  const { value } = props;
  if (!value) return '-';
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };
  
  return formatBytes(value);
};

const FilePathCellRenderer = (props: any) => {
  const { value, data } = props;
  const pathParts = value.split('/').filter((part: string) => part);
  const folders = pathParts.slice(0, -1);
  
  return (
    <div className="flex flex-col">
      {folders.length > 0 && (
        <span className="text-xs text-gray-500">
          /{folders.join('/')}/
        </span>
      )}
      <span className="font-medium text-sm">{data.fileName}</span>
    </div>
  );
};

export const DocumentSelectorGrid: React.FC = () => {
  const gridRef = useRef<AgGridReact>(null);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<DocumentFile[]>([]);

  // Sample data
  const rowData = useMemo(() => generateSampleData(), []);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Select',
      field: 'select',
      width: 80,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      pinned: 'left',
      sortable: false,
      filter: false
    },
    {
      headerName: 'File',
      field: 'filePath',
      flex: 2,
      cellRenderer: FilePathCellRenderer,
      filter: 'agTextColumnFilter',
      filterParams: {
        textMatcher: createDelimiterTextMatcher({
          pathField: 'filePath',
          fileNameField: 'fileName'
        }),
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

  // Grid options
  const gridOptions = useMemo(() => ({
    rowSelection: 'multiple' as const,
    suppressRowDeselection: false,
    rowMultiSelectWithClick: true,
    
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

  // Handle selection changes
  const onSelectionChanged = useCallback(() => {
    if (!gridApi) return;
    
    const selectedRows = gridApi.getSelectedRows();
    setSelectedFiles(selectedRows);
  }, [gridApi]);

  // Show advanced filter
  const toggleAdvancedFilter = useCallback(() => {
    if (!gridApi) return;
    let currentfilter = gridApi.getGridOption('enableAdvancedFilter')
    // Enable advanced filter first
    gridApi.setGridOption('enableAdvancedFilter', !currentfilter);
    
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
    return AGGridSearchParser.getSearchHint(globalSearch);
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
        
        {/* Search hint */}
        <div className="text-xs text-gray-600">
          {getSearchHint()}
        </div>
        
        {/* Debug info for development */}
        {globalSearch && (
          <div className="text-xs text-purple-600 mt-1">
            Debug: Applied filters - {JSON.stringify(AGGridSearchParser.createFilterModel(globalSearch, {
              pathField: 'filePath',
              fileNameField: 'fileName'
            }))}
          </div>
        )}
        
        {/* Selection summary */}
        {selectedFiles.length > 0 && (
          <div className="mt-2 text-sm text-blue-600">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {/* AG Grid */}
      <div className="flex-1 ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
          onSelectionChanged={onSelectionChanged}
          suppressMenuHide={true}
          enableCellTextSelection={true}
          theme="legacy"
        />
      </div>

      {/* Selection Details */}
      {selectedFiles.length > 0 && (
        <div className="p-4 border-t bg-gray-50 max-h-48 overflow-y-auto">
          <h3 className="font-medium mb-2">Selected Files:</h3>
          <div className="space-y-1">
            {selectedFiles.map((file) => (
              <div key={file.id} className="text-sm flex items-center justify-between">
                <span className="font-medium">{file.fileName}</span>
                <span className="text-gray-500 text-xs">{file.filePath}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};