// lib/ag-grid-search-utils.ts
// Enhanced search parser for AG Grid integration with slash delimiter logic

export interface ParsedSearchInput {
  pathQuery?: string;
  fileNameQuery?: string;
  hasWildcard: boolean;
  sortByFileName: boolean;
  originalInput: string;
}

export interface ColumnMappings {
  pathField?: string;
  fileNameField?: string;
}

/**
 * Enhanced search parser for AG Grid integration
 * Handles slash delimiter logic and wildcard sorting
 */
export class AGGridSearchParser {
  /**
   * Parse search input with "/" delimiter logic
   * Examples:
   * - "agreement" -> search filename only
   * - "contracts/agreement" -> search path contains "contracts" AND filename contains "agreement"
   * - "exhibit *" -> search filename contains "exhibit" AND sort by filename
   * - "discovery/exhibit *" -> path contains "discovery" AND filename contains "exhibit" AND sort
   */
  static parseSearchInput(input: string): ParsedSearchInput {
    const originalInput = input;
    
    if (!input.trim()) {
      return { 
        hasWildcard: false, 
        sortByFileName: false, 
        originalInput 
      };
    }

    const hasWildcard = input.includes('*');
    const cleanInput = input.replace(/\*/g, '').trim();

    if (cleanInput.includes('/')) {
      const [pathPart, fileNamePart] = cleanInput.split('/', 2);
      return {
        pathQuery: pathPart.trim() || undefined,
        fileNameQuery: fileNamePart.trim() || undefined,
        hasWildcard,
        sortByFileName: hasWildcard,
        originalInput
      };
    }

    // Default: search file name only
    return {
      fileNameQuery: cleanInput,
      hasWildcard,
      sortByFileName: hasWildcard,
      originalInput
    };
  }

  /**
   * Create AG Grid filter model from parsed search input
   */
  static createFilterModel(searchInput: string, columnMappings?: ColumnMappings): any {
    const parsed = this.parseSearchInput(searchInput);
    const filterModel: any = {};
    
    const pathField = columnMappings?.pathField || 'filePath';
    const fileNameField = columnMappings?.fileNameField || 'fileName';

    if (parsed.pathQuery) {
      filterModel[pathField] = {
        filterType: 'text',
        type: 'contains',
        filter: parsed.pathQuery
      };
    }

    if (parsed.fileNameQuery) {
      filterModel[fileNameField] = {
        filterType: 'text',
        type: 'contains',
        filter: parsed.fileNameQuery
      };
    }

    return filterModel;
  }

  /**
   * Create AG Grid sort model from parsed search input
   */
  static createSortModel(searchInput: string, sortField?: string): any[] {
    const parsed = this.parseSearchInput(searchInput);
    
    if (parsed.sortByFileName) {
      return [{ colId: sortField || 'fileName', sort: 'asc' }];
    }

    return [];
  }

  /**
   * Check if search input matches a file path using the same logic
   * Useful for non-AG Grid filtering scenarios
   */
  static matchesPath(searchInput: string, filePath: string, fileName?: string): boolean {
    const parsed = this.parseSearchInput(searchInput);
    
    // Extract filename if not provided
    if (!fileName) {
      const parts = filePath.split('/');
      fileName = parts[parts.length - 1] || '';
    }
    
    // Check path match if specified
    if (parsed.pathQuery) {
      const pathMatch = filePath.toLowerCase().includes(parsed.pathQuery.toLowerCase());
      if (!pathMatch) return false;
    }
    
    // Check filename match if specified
    if (parsed.fileNameQuery) {
      const fileNameMatch = fileName.toLowerCase().includes(parsed.fileNameQuery.toLowerCase());
      if (!fileNameMatch) return false;
    }
    
    return true;
  }

  /**
   * Generate search hint text for UI display
   */
  static getSearchHint(searchInput: string): string {
    if (!searchInput.trim()) {
      return 'Type to search file names, use "/" for path/filename (e.g., "documents/agreement")';
    }
    
    const parsed = this.parseSearchInput(searchInput);
    const hints: string[] = [];
    
    if (parsed.pathQuery) {
      hints.push(`Path contains "${parsed.pathQuery}"`);
    }
    if (parsed.fileNameQuery) {
      hints.push(`Filename contains "${parsed.fileNameQuery}"`);
    }
    if (parsed.sortByFileName) {
      hints.push('Sorted by filename');
    }
    
    return hints.join(' AND ');
  }

  /**
   * Validate search input and provide feedback
   */
  static validateSearchInput(input: string): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    if (input.includes('//')) {
      warnings.push('Double slashes detected - use single "/" to separate path and filename');
    }
    
    if (input.split('/').length > 2) {
      warnings.push('Only one "/" delimiter is supported - additional slashes will be treated as literal characters');
    }
    
    if (input.includes('*') && input.trim().endsWith('*')) {
      suggestions.push('Wildcard "*" will sort results by filename');
    }
    
    if (input.includes('/') && !input.split('/')[1].trim()) {
      suggestions.push('Add filename search after "/" for more specific results');
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    };
  }
}

/**
 * Custom text matcher for AG Grid that implements the slash delimiter logic
 * Use this with AG Grid's textMatcher parameter
 */
export const createDelimiterTextMatcher = (columnMappings?: ColumnMappings) => {
  return ({ filterOption, value, filterText }: any) => {
    if (!filterText) return true;

    // If value is an object (row data), extract the appropriate fields
    let filePath = '';
    let fileName = '';
    
    if (typeof value === 'object' && value !== null) {
      const pathField = columnMappings?.pathField || 'filePath';
      const fileNameField = columnMappings?.fileNameField || 'fileName';
      
      filePath = value[pathField] || '';
      fileName = value[fileNameField] || '';
    } else {
      // If value is a string, treat it as the file path
      filePath = value || '';
      const parts = filePath.split('/');
      fileName = parts[parts.length - 1] || '';
    }

    // Use the parser to check if the search matches
    return AGGridSearchParser.matchesPath(filterText, filePath, fileName);
  };
};

/**
 * Create custom filter options that include delimiter-aware searching
 */
export const createDelimiterFilterOptions = () => {
  return [
    'contains',
    'startsWith',
    'endsWith',
    {
      displayKey: 'delimiter',
      displayName: 'Smart Search (use / for path/file)',
      predicate: ([filterValue]: any[], cellValue: any) => {
        if (!filterValue) return true;
        return AGGridSearchParser.matchesPath(filterValue, cellValue?.filePath || '', cellValue?.fileName || '');
      },
      numberOfInputs: 1
    }
  ];
};