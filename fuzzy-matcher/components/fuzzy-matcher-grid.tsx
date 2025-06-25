// components/fuzzy-matcher-grid.tsx
// AGGrid component with advanced filtering and fuzzy matching capabilities
'use client'// components/fuzzy-matcher-grid.tsx
// AGGrid component with advanced filtering and fuzzy matching capabilities

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';

// Import required modules
import { ModuleRegistry } from 'ag-grid-community'; 
import { AllEnterpriseModule } from 'ag-grid-enterprise';

// Register all Community and Enterprise features
ModuleRegistry.registerModules([AllEnterpriseModule]);

import { ColDef, GridReadyEvent, GridApi, ITextFilterParams } from 'ag-grid-community';

// Import styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Data structure expected by fuzzy matcher
interface FileReference {
  id: string;
  filePath: string;
  fileName: string;
  description: string;
  order?: number;
  isSelected?: boolean;
  isGenerated?: boolean;
  date?: string;
  reference?: string;
}

interface OrderedSelection {
  item: FileReference;
  order: number;
}

// Fuzzy matching algorithm implementation
const fuzzyMatch = (needle: string, haystack: string, caseSensitive = false): number => {
  if (!needle || !haystack) return 0;
  
  const searchText = caseSensitive ? needle : needle.toLowerCase();
  const targetText = caseSensitive ? haystack : haystack.toLowerCase();
  
  let searchIndex = 0;
  let matches = 0;
  
  for (let i = 0; i < targetText.length && searchIndex < searchText.length; i++) {
    if (targetText[i] === searchText[searchIndex]) {
      searchIndex++;
      matches++;
    }
  }
  
  // Return a score between 0 and 1
  return searchIndex === searchText.length ? matches / searchText.length : 0;
};

// Custom text matcher for delimiter parsing and fuzzy matching
const customTextMatcher = ({ filterOption, value, filterText }: any) => {
  if (!filterText) return true;
  
  const filePath = value?.filePath || '';
  const fileName = value?.fileName || '';
  const description = value?.description || '';
  
  // Parse delimiter logic: text before "/" matches path, after "/" matches filename
  if (filterText.includes('/')) {
    const parts = filterText.split('/');
    const pathPart = parts[0]?.trim();
    const filenamePart = parts[1]?.trim();
    
    const pathMatch = pathPart ? 
      filePath.toLowerCase().includes(pathPart.toLowerCase()) : true;
    const filenameMatch = filenamePart ? 
      fileName.toLowerCase().includes(filenamePart.toLowerCase()) : true;
      
    return pathMatch && filenameMatch;
  }
  
  // Default: match filename only with fuzzy matching support
  switch (filterOption) {
    case 'fuzzy':
      return fuzzyMatch(filterText, fileName) > 0.3 || 
             fuzzyMatch(filterText, description) > 0.3;
    case 'contains':
      return fileName.toLowerCase().includes(filterText.toLowerCase()) ||
             description.toLowerCase().includes(filterText.toLowerCase());
    case 'startsWith':
      return fileName.toLowerCase().startsWith(filterText.toLowerCase());
    case 'endsWith':
      return fileName.toLowerCase().endsWith(filterText.toLowerCase());
    default:
      return fileName.toLowerCase().includes(filterText.toLowerCase());
  }
};

// Custom filter options including fuzzy matching
const customFilterOptions = [
  'contains',
  'startsWith', 
  'endsWith',
  {
    displayKey: 'fuzzy',
    displayName: 'Fuzzy Match',
    predicate: ([filterValue]: any[], cellValue: any) => {
      if (!filterValue) return true;
      return fuzzyMatch(filterValue, cellValue?.fileName || '') > 0.3;
    },
    numberOfInputs: 1
  }
];

// Multi-select cell renderer with order display
const MultiSelectCellRenderer = (props: any) => {
  const { data, onSelectionChange, selectedItems } = props;
  
  const selectedItem = selectedItems.find((item: OrderedSelection) => item.item.id === data.id);
  const isSelected = !!selectedItem;
  const order = selectedItem?.order;
  
  const handleToggle = () => {
    onSelectionChange(data, !isSelected);
  };
  
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleToggle}
        className="rounded"
      />
      {isSelected && (
        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
          {order}
        </span>
      )}
    </div>
  );
};

// Path cell renderer with custom styling
const PathCellRenderer = (props: any) => {
  const { value } = props;
  const pathParts = value?.split('/') || [];
  const fileName = pathParts.pop();
  const folderPath = pathParts.join('/');
  
  return (
    <div className="flex flex-col text-sm">
      {folderPath && (
        <span className="text-gray-500 text-xs">{folderPath}/</span>
      )}
      <span className="font-medium">{fileName}</span>
    </div>
  );
};

export const FuzzyMatcherGrid: React.FC = () => {
  const gridRef = useRef<AgGridReact>(null);
  const [selectedItems, setSelectedItems] = useState<OrderedSelection[]>([]);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Generate sample data
  const rowData = useMemo<FileReference[]>(() => [
    {
      id: '1',
      filePath: '/documents/contracts/agreement-2024.pdf',
      fileName: 'agreement-2024.pdf',
      description: 'Service Agreement Contract 2024',
      date: '2024-01-15',
      reference: 'AG-2024-001'
    },
    {
      id: '2', 
      filePath: '/reports/financial/q1-report.xlsx',
      fileName: 'q1-report.xlsx',
      description: 'Q1 Financial Report',
      date: '2024-03-31',
      reference: 'FIN-Q1-2024'
    },
    {
      id: '3',
      filePath: '/images/logos/company-logo.png',
      fileName: 'company-logo.png', 
      description: 'Company Brand Logo',
      isGenerated: true
    },
    {
      id: '4',
      filePath: '/documents/legal/terms-of-service.docx',
      fileName: 'terms-of-service.docx',
      description: 'Legal Terms of Service Document',
      date: '2024-02-10',
      reference: 'LEG-TOS-2024'
    },
    {
      id: '5',
      filePath: '/data/exports/customer-data-export.csv',
      fileName: 'customer-data-export.csv',
      description: 'Customer Database Export',
      date: '2024-06-20',
      reference: 'DATA-EXPORT-001'
    }
  ], []);

  // Handle selection changes with order persistence
  const handleSelectionChange = useCallback((item: FileReference, isSelected: boolean) => {
    setSelectedItems(prev => {
      if (!isSelected) {
        // Remove item and maintain order numbers
        return prev.filter(selected => selected.item.id !== item.id);
      } else {
        // Add item with next available order number
        const usedOrders = new Set(prev.map(selected => selected.order));
        let nextOrder = 1;
        while (usedOrders.has(nextOrder)) {
          nextOrder++;
        }
        
        return [...prev, { item, order: nextOrder }];
      }
    });
  }, []);

  // Column definitions with advanced filtering
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Select',
      field: 'select',
      width: 100,
      cellRenderer: MultiSelectCellRenderer,
      cellRendererParams: {
        onSelectionChange: handleSelectionChange,
        selectedItems
      },
      sortable: false,
      filter: false,
      pinned: 'left'
    },
    {
      headerName: 'File Path',
      field: 'filePath',
      width: 300,
      cellRenderer: PathCellRenderer,
      filter: 'agTextColumnFilter',
      filterParams: {
        textMatcher: customTextMatcher,
        filterOptions: customFilterOptions,
        debounceMs: 300,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true
    },
    {
      headerName: 'File Name',
      field: 'fileName',
      width: 200,
      filter: 'agTextColumnFilter',
      filterParams: {
        textMatcher: customTextMatcher,
        filterOptions: customFilterOptions,
        debounceMs: 300,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true
    },
    {
      headerName: 'Description',
      field: 'description',
      flex: 1,
      filter: 'agTextColumnFilter',
      filterParams: {
        textMatcher: customTextMatcher,
        filterOptions: customFilterOptions,
        debounceMs: 300,
        caseSensitive: false
      } as ITextFilterParams,
      floatingFilter: true
    },
    {
      headerName: 'ID',
      field: 'id',
      hide: true // Hidden column as specified
    }
  ], [selectedItems, handleSelectionChange]);

  // Grid options for optimal performance
  const gridOptions = useMemo(() => ({
    rowBuffer: 10,
    suppressRowVirtualisation: false,
    cacheQuickFilter: true,
    debounceVerticalScrollbar: true,
    animateRows: false,
    suppressColumnMoveAnimation: true,
    suppressRowHoverHighlight: true,
    rowSelection: 'multiple' as const,
    suppressRowDeselection: true,
    enableAdvancedFilter: true,
    advancedFilterBuilderParams: {
      showMoveButtons: true,
      debounceMs: 300
    }
  }), []);

  // Handle grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Bulk selection actions
  const selectAll = () => {
    const newSelections = rowData.map((item, index) => ({
      item,
      order: index + 1
    }));
    setSelectedItems(newSelections);
  };

  const clearAll = () => {
    setSelectedItems([]);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Control Panel */}
      <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fuzzy Matcher Grid</h2>
          <p className="text-sm text-gray-600">
            Use "/" to filter path/filename (e.g., "documents/agreement"). Default search matches filename.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Select All
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
          </button>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded">
            Selected: {selectedItems.length}
          </span>
        </div>
      </div>

      {/* AGGrid */}
      <div className="flex-1 ag-theme-alpine">
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

      {/* Selected Items Display */}
      {selectedItems.length > 0 && (
        <div className="p-4 bg-gray-50 border-t">
          <h3 className="font-medium mb-2">Selected Items (in order):</h3>
          <div className="space-y-1">
            {selectedItems
              .sort((a, b) => a.order - b.order)
              .map(({ item, order }) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full w-6 h-6 flex items-center justify-center">
                    {order}
                  </span>
                  <span className="font-medium">{item.fileName}</span>
                  <span className="text-gray-500">- {item.description}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};