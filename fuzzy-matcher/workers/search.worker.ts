import { SearchResult } from '../lib/types';

// Memoization function for worker context
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Core matching algorithms (moved from fuzzy-matcher.ts)
const calculateSimilarity = memoize((string1: string, string2: string): number => {
  if (!string1 || !string2) return 0;
  
  const str1 = string1.toLowerCase();
  const str2 = string2.toLowerCase();
  
  if (str1 === str2) return 1.0;
  if (str1.includes(str2)) return 0.9;
  if (str2.includes(str1)) return 0.85;
  
  const words1 = str1.split(/[\s\/\-_\.]+/);
  const words2 = str2.split(/[\s\/\-_\.]+/);
  
  let wordMatches = 0;
  for (const word2 of words2) {
    for (const word1 of words1) {
      if (word1.includes(word2) || word2.includes(word1)) {
        wordMatches++;
        break;
      }
    }
  }
  
  const wordScore = wordMatches / Math.max(words1.length, words2.length);
  
  const chars1 = [...str1];
  const chars2 = [...str2];
  let charMatches = 0;
  
  for (const char of chars2) {
    const index = chars1.indexOf(char);
    if (index !== -1) {
      charMatches++;
      chars1.splice(index, 1);
    }
  }
  
  const charScore = charMatches / Math.max(str1.length, str2.length);
  return (wordScore * 0.7) + (charScore * 0.3);
});

function calculateFuzzyScore(filePath: string, searchTerm: string): number {
  if (!searchTerm.trim()) return 0;
  
  const parts = filePath.split('/');
  const fileName = parts.pop() || '';
  const pathParts = parts.join('/');
  const folderNames = parts.slice(0, -1);
  
  if (searchTerm.endsWith('/')) {
    const folderSearchTerm = searchTerm.slice(0, -1);
    return calculateSimilarity(pathParts, folderSearchTerm);
  }
  
  if (searchTerm.includes('/')) {
    const searchParts = searchTerm.split('/');
    const searchPath = searchParts.slice(0, -1).join('/');
    const searchFile = searchParts[searchParts.length - 1];
    
    const pathScore = calculateSimilarity(pathParts, searchPath);
    const fileScore = calculateSimilarity(fileName, searchFile);
    
    return (fileScore * 0.7) + (pathScore * 0.5);
  }
  
  const fileNameScore = calculateSimilarity(fileName, searchTerm);
  
  let bestFolderScore = 0;
  for (const folderName of folderNames) {
    const folderScore = calculateSimilarity(folderName, searchTerm);
    bestFolderScore = Math.max(bestFolderScore, folderScore);
  }
  
  return Math.max(fileNameScore * 0.8 + bestFolderScore * 0.3, bestFolderScore * 0.8);
}

function cleanFileName(text: string): string {
  if (!text) return "";
  
  return text
    .replace(/\.[^/.]+$/, '')
    .replace(/^\w+-/, '')
    .replace(/\d{4}-\d{2}-\d{2}/, '')
    .replace(/_v\d+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractKeyTerms(text: string): string {
  if (!text) return "";
  const keyTermRegex = /([A-Z]+-?\d+-\d+)|([A-Z]+-?\d+)|(\d{3,})/g;
  const matches = text.match(keyTermRegex);
  return matches ? matches.join(' ') : cleanFileName(text);
}

// Worker-based SearchIndex implementation
class WorkerSearchIndex {
  private allFilePaths: string[];
  private searchIndex: Map<string, Set<string>>;

  constructor(filePaths: string[]) {
    this.allFilePaths = filePaths;
    this.searchIndex = this.buildIndex(filePaths);
  }

  private buildIndex(filePaths: string[]): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    const totalPaths = filePaths.length;
    
    for (let i = 0; i < filePaths.length; i++) {
      const path = filePaths[i];
      
      // Progress reporting for large datasets
      if (i % 1000 === 0) {
        self.postMessage({
          type: 'INDEX_PROGRESS',
          progress: (i / totalPaths) * 100,
          completed: i,
          total: totalPaths
        });
      }
      
      const pathTokens = cleanFileName(path.replace(/\//g, ' ')).split(' ');
      const keyTermTokens = extractKeyTerms(path).toLowerCase().split(' ');
      const allTokens = new Set([...pathTokens, ...keyTermTokens].filter(t => t.length > 1));

      for (const token of allTokens) {
        if (!index.has(token)) {
          index.set(token, new Set());
        }
        index.get(token)!.add(path);
      }
    }
    
    return index;
  }

  private hasRegexPattern(searchTerm: string): boolean {
    return /[*?+\[\](){}|\\^$]/.test(searchTerm);
  }

  private createRegexFromPattern(pattern: string): RegExp {
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '(.*)')
      .replace(/\\\?/g, '(.)');

    return new RegExp(regexPattern, 'i');
  }

  private extractSortableValue(filePath: string, regex: RegExp): { value: string; sortKey: number | string } {
    const fileName = filePath.split('/').pop() || filePath;
    const match = fileName.match(regex);
    
    if (!match || !match[1]) {
      return { value: fileName, sortKey: fileName };
    }

    const capturedValue = match[1];
    const numberMatch = capturedValue.match(/(\d+)/);
    if (numberMatch) {
      return { 
        value: capturedValue, 
        sortKey: parseInt(numberMatch[1], 10) 
      };
    }

    return { value: capturedValue, sortKey: capturedValue };
  }

  private applyRegexSorting(results: SearchResult[], pattern: string): SearchResult[] {
    const regex = this.createRegexFromPattern(pattern);
    
    const regexMatches = results.filter(result => {
      const fileName = result.path.split('/').pop() || result.path;
      return regex.test(fileName);
    });

    if (regexMatches.length === 0) {
      return results;
    }

    const withSortKeys = regexMatches.map(result => ({
      ...result,
      sortData: this.extractSortableValue(result.path, regex)
    }));

    withSortKeys.sort((a, b) => {
      const aKey = a.sortData.sortKey;
      const bKey = b.sortData.sortKey;

      if (typeof aKey === 'number' && typeof bKey === 'number') {
        return aKey - bKey;
      }

      if (typeof aKey === 'string' && typeof bKey === 'string') {
        return aKey.localeCompare(bKey);
      }

      if (typeof aKey === 'number') return -1;
      if (typeof bKey === 'number') return 1;

      return 0;
    });

    return withSortKeys.map(({ sortData, ...result }) => result);
  }

  public search(searchTerm: string, usedFilePaths: Set<string>): SearchResult[] {
    const availableFilePaths = this.allFilePaths.filter(path => !usedFilePaths.has(path));
    const trimmedSearchTerm = searchTerm.trim();
    
    if (!trimmedSearchTerm) {
      return availableFilePaths.map(path => ({ path, score: 0 }));
    }

    const isRegexPattern = this.hasRegexPattern(trimmedSearchTerm);
    
    if (isRegexPattern) {
      const basePattern = trimmedSearchTerm.replace(/[*?+\[\](){}|\\^$]/g, '');
      const cleanedSearchTerm = cleanFileName(basePattern);
      const keyTermsSearch = extractKeyTerms(basePattern);
      
      if (cleanedSearchTerm.trim() || keyTermsSearch.trim()) {
        const searchTokens = new Set([
          ...cleanedSearchTerm.split(' '),
          ...keyTermsSearch.toLowerCase().split(' ')
        ].filter(t => t.length > 1));
        
        const candidatePaths = new Set<string>();
        for (const token of searchTokens) {
          for (const [indexKey, paths] of this.searchIndex.entries()) {
            if (indexKey.includes(token)) {
              paths.forEach(path => candidatePaths.add(path));
            }
          }
        }

        const fuzzyMatches = Array.from(candidatePaths)
          .filter(path => !usedFilePaths.has(path))
          .map(filePath => {
            const pathParts = filePath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const cleanedFileName = cleanFileName(fileName);
            
            const originalScore = calculateFuzzyScore(filePath, basePattern);
            const cleanedScore = calculateFuzzyScore(cleanedFileName, cleanedSearchTerm);
            const keyTermsScore = calculateFuzzyScore(filePath, keyTermsSearch);
            
            return {
              path: filePath,
              score: Math.max(originalScore, cleanedScore, keyTermsScore)
            };
          })
          .filter(item => item.score > 0.05)
          .sort((a, b) => b.score - a.score)
          .slice(0, 100);

        return this.applyRegexSorting(fuzzyMatches, trimmedSearchTerm);
      } else {
        const allResults = availableFilePaths.map(path => ({ path, score: 0.5 }));
        return this.applyRegexSorting(allResults, trimmedSearchTerm);
      }
    }

    // Regular fuzzy search
    const cleanedSearchTerm = cleanFileName(trimmedSearchTerm);
    const keyTermsSearch = extractKeyTerms(trimmedSearchTerm);
    const searchTokens = new Set([
        ...cleanedSearchTerm.split(' '),
        ...keyTermsSearch.toLowerCase().split(' ')
    ].filter(t => t.length > 1));
    
    const candidatePaths = new Set<string>();
    for (const token of searchTokens) {
        for (const [indexKey, paths] of this.searchIndex.entries()) {
            if(indexKey.includes(token)) {
                paths.forEach(path => candidatePaths.add(path));
            }
        }
    }

    const matches = Array.from(candidatePaths)
      .filter(path => !usedFilePaths.has(path))
      .map(filePath => {
        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const cleanedFileName = cleanFileName(fileName);
        
        const originalScore = calculateFuzzyScore(filePath, trimmedSearchTerm);
        const cleanedScore = calculateFuzzyScore(cleanedFileName, cleanedSearchTerm);
        const keyTermsScore = calculateFuzzyScore(filePath, keyTermsSearch);
        
        return {
          path: filePath,
          score: Math.max(originalScore, cleanedScore, keyTermsScore)
        };
      })
      .filter(item => item.score > 0.05);
      
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 50);
  }
}

// Worker state
let searchIndex: WorkerSearchIndex | null = null;

// Message handler
self.onmessage = function(e) {
  const { type, id, data } = e.data;
  
  try {
    switch (type) {
      case 'INITIALIZE_INDEX':
        const { filePaths } = data;
        searchIndex = new WorkerSearchIndex(filePaths);
        self.postMessage({
          type: 'INITIALIZE_COMPLETE',
          id,
          data: { indexSize: filePaths.length }
        });
        break;
        
      case 'SEARCH':
        if (!searchIndex) {
          throw new Error('Search index not initialized');
        }
        
        const { searchTerm, usedFilePaths } = data;
        const usedPathsSet = new Set(usedFilePaths);
        const results = searchIndex.search(searchTerm, usedPathsSet);
        
        self.postMessage({
          type: 'SEARCH_COMPLETE',
          id,
          data: { results }
        });
        break;
        
      case 'UPDATE_USED_PATHS':
        // This is for future optimization - we could cache used paths
        self.postMessage({
          type: 'USED_PATHS_UPDATED',
          id,
          data: { success: true }
        });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    self.postMessage({
      type: 'ERROR',
      id,
      error: errorMessage
    });
  }
};

// Error handling
self.onerror = function(error) {
  self.postMessage({
    type: 'WORKER_ERROR',
    error: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno
    }
  });
};

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(event) {
  self.postMessage({
    type: 'WORKER_ERROR',
    error: {
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack
    }
  });
});