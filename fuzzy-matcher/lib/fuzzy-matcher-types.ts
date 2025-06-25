// lib/fuzzy-matcher-types.ts
// Complete type definitions and utilities for the fuzzy matcher AGGrid implementation

export interface FileReference {
  id: string; // Hidden field - unique identifier for each record
  filePath: string; // Full file path including directories
  fileName: string; // Extracted filename from path
  description: string; // Human-readable description for fuzzy matching
  order?: number; // Order in multi-select (optional for display)
  isSelected?: boolean; // Selection state (managed by component)
  isGenerated?: boolean; // Whether this was auto-generated or imported
  date?: string; // Optional date information
  reference?: string; // Optional reference code
}

export interface OrderedSelection {
  item: FileReference;
  order: number; // Persistent order number for multi-select
}

export interface FuzzyMatchResult {
  score: number; // Match confidence score (0-1)
  matchedText: string; // The text that matched
  matchType: 'path' | 'filename' | 'description'; // What field matched
}

export interface FilterState {
  selectedItems: OrderedSelection[];
  filterMode: 'contains' | 'fuzzy' | 'startsWith' | 'endsWith';
  searchText: string;
  caseSensitive: boolean;
}

// Utility functions for path parsing and fuzzy matching

export class PathParser {
  /**
   * Parse input with "/" delimiter logic
   * Text before "/" matches path, after "/" matches filename
   * Default behavior: match filename only
   */
  static parseSearchInput(input: string): { pathQuery?: string; filenameQuery?: string } {
    if (!input.includes('/')) {
      // Default: match filename only
      return { filenameQuery: input.trim() };
    }

    const parts = input.split('/');
    const pathPart = parts[0]?.trim();
    const filenamePart = parts[1]?.trim();

    return {
      pathQuery: pathPart || undefined,
      filenameQuery: filenamePart || undefined
    };
  }

  /**
   * Extract filename from full path
   */
  static extractFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || '';
  }

  /**
   * Extract directory path from full path
   */
  static extractDirectoryPath(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop(); // Remove filename
    return parts.join('/');
  }
}

export class FuzzyMatcher {
  /**
   * Calculate fuzzy match score using character sequence matching
   * Returns score between 0 and 1, where 1 is perfect match
   */
  static calculateScore(needle: string, haystack: string, caseSensitive = false): number {
    if (!needle || !haystack) return 0;

    const searchText = caseSensitive ? needle : needle.toLowerCase();
    const targetText = caseSensitive ? haystack : haystack.toLowerCase();

    let searchIndex = 0;
    let matches = 0;

    // Count sequential character matches
    for (let i = 0; i < targetText.length && searchIndex < searchText.length; i++) {
      if (targetText[i] === searchText[searchIndex]) {
        searchIndex++;
        matches++;
      }
    }

    // Calculate score based on completion and density
    const completion = searchIndex / searchText.length;
    const density = matches / targetText.length;
    
    return completion === 1 ? (completion + density) / 2 : completion * 0.7;
  }

  /**
   * Enhanced fuzzy matching with multiple criteria
   */
  static match(query: string, item: FileReference, threshold = 0.3): FuzzyMatchResult | null {
    const { pathQuery, filenameQuery } = PathParser.parseSearchInput(query);
    
    let bestScore = 0;
    let matchedText = '';
    let matchType: 'path' | 'filename' | 'description' = 'filename';

    // Test filename matching (primary)
    if (filenameQuery) {
      const filenameScore = this.calculateScore(filenameQuery, item.fileName);
      if (filenameScore > bestScore) {
        bestScore = filenameScore;
        matchedText = item.fileName;
        matchType = 'filename';
      }
    }

    // Test path matching if specified
    if (pathQuery) {
      const pathScore = this.calculateScore(pathQuery, PathParser.extractDirectoryPath(item.filePath));
      if (pathScore > bestScore) {
        bestScore = pathScore;
        matchedText = PathParser.extractDirectoryPath(item.filePath);
        matchType = 'path';
      }
    }

    // Test description matching as fallback
    const descriptionScore = this.calculateScore(query, item.description);
    if (descriptionScore > bestScore) {
      bestScore = descriptionScore;
      matchedText = item.description;
      matchType = 'description';
    }

    return bestScore >= threshold ? {
      score: bestScore,
      matchedText,
      matchType
    } : null;
  }
}

export class SelectionManager {
  /**
   * Manage multi-select with order persistence
   */
  static toggleSelection(
    item: FileReference, 
    currentSelections: OrderedSelection[]
  ): OrderedSelection[] {
    const existingIndex = currentSelections.findIndex(
      selection => selection.item.id === item.id
    );

    if (existingIndex >= 0) {
      // Remove existing selection, keep other orders intact
      return currentSelections.filter((_, index) => index !== existingIndex);
    } else {
      // Add new selection with next available order
      const usedOrders = new Set(currentSelections.map(s => s.order));
      let nextOrder = 1;
      
      while (usedOrders.has(nextOrder)) {
        nextOrder++;
      }

      return [...currentSelections, { item, order: nextOrder }];
    }
  }

  /**
   * Get selected items sorted by order
   */
  static getOrderedSelections(selections: OrderedSelection[]): FileReference[] {
    return selections
      .sort((a, b) => a.order - b.order)
      .map(selection => selection.item);
  }

  /**
   * Clear all selections
   */
  static clearAll(): OrderedSelection[] {
    return [];
  }

  /**
   * Select all items with sequential ordering
   */
  static selectAll(items: FileReference[]): OrderedSelection[] {
    return items.map((item, index) => ({
      item,
      order: index + 1
    }));
  }
}

// Sample data generator for testing
export class SampleDataGenerator {
  static generateFileReferences(count = 20): FileReference[] {
    const samplePaths = [
      '/documents/contracts/service-agreement-2024.pdf',
      '/documents/contracts/nda-template.docx', 
      '/reports/financial/q1-2024-revenue.xlsx',
      '/reports/financial/q2-2024-expenses.csv',
      '/reports/marketing/campaign-analysis.pptx',
      '/images/logos/company-logo-2024.png',
      '/images/banners/website-header.jpg',
      '/data/exports/customer-database.sql',
      '/data/exports/product-catalog.json',
      '/backups/system/daily-backup-june.zip',
      '/backups/database/user-data-backup.sql',
      '/documents/legal/privacy-policy.pdf',
      '/documents/legal/terms-of-service.html',
      '/templates/email/welcome-template.html',
      '/templates/reports/monthly-report-template.docx',
      '/projects/website/src/components/header.tsx',
      '/projects/mobile-app/assets/icons.svg',
      '/training/materials/onboarding-guide.pdf',
      '/training/videos/product-demo.mp4',
      '/archives/2023/old-project-files.tar.gz'
    ];

    return Array.from({ length: Math.min(count, samplePaths.length) }, (_, index) => {
      const filePath = samplePaths[index];
      const fileName = PathParser.extractFileName(filePath);
      const fileExtension = fileName.split('.').pop() || '';
      
      // Generate description based on filename and path
      let description = fileName
        .replace(/\.[^/.]+$/, '') // Remove extension
        .replace(/[-_]/g, ' ') // Replace dashes and underscores
        .replace(/\b\w/g, l => l.toUpperCase()); // Title case

      return {
        id: `file-${index + 1}`,
        filePath,
        fileName,
        description,
        isGenerated: Math.random() > 0.7, // 30% are generated
        date: index % 3 === 0 ? `2024-0${Math.floor(Math.random() * 6) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}` : undefined,
        reference: index % 4 === 0 ? `REF-${String(index + 1).padStart(3, '0')}` : undefined
      };
    });
  }
}

// AG Grid specific utilities
export class AGGridFilterUtils {
  /**
   * Create custom text matcher for AG Grid
   */
  static createCustomTextMatcher() {
    return ({ filterOption, value, filterText }: any) => {
      if (!filterText) return true;

      const item = value as FileReference;
      const { pathQuery, filenameQuery } = PathParser.parseSearchInput(filterText);

      // Handle delimiter parsing
      if (pathQuery && filenameQuery) {
        const pathMatch = PathParser.extractDirectoryPath(item.filePath)
          .toLowerCase()
          .includes(pathQuery.toLowerCase());
        const filenameMatch = item.fileName
          .toLowerCase()
          .includes(filenameQuery.toLowerCase());
        return pathMatch && filenameMatch;
      }

      // Default filename matching with filter options
      const searchTarget = filenameQuery || filterText;
      const searchIn = item.fileName.toLowerCase();
      const searchText = searchTarget.toLowerCase();

      switch (filterOption) {
        case 'fuzzy':
          return FuzzyMatcher.calculateScore(searchText, searchIn) >= 0.3;
        case 'contains':
          return searchIn.includes(searchText);
        case 'startsWith':
          return searchIn.startsWith(searchText);
        case 'endsWith':
          return searchIn.endsWith(searchText);
        default:
          return searchIn.includes(searchText);
      }
    };
  }

  /**
   * Create custom filter options for AG Grid
   */
  static createCustomFilterOptions() {
    return [
      'contains',
      'startsWith',
      'endsWith',
      {
        displayKey: 'fuzzy',
        displayName: 'Fuzzy Match',
        predicate: ([filterValue]: any[], cellValue: any) => {
          if (!filterValue) return true;
          const item = cellValue as FileReference;
          return FuzzyMatcher.calculateScore(filterValue, item.fileName) >= 0.3;
        },
        numberOfInputs: 1
      }
    ];
  }
}