// lib/fuzzy-matcher.ts - Optimized Core Matching Algorithm

import { SearchResult } from './types';

/**
 * A higher-order function to memoize the results of another function.
 * Caches results in memory to avoid re-computing for the same inputs.
 * @param fn The function to memoize.
 */
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

/**
 * Calculates a similarity score between two strings.
 * This function is memoized to cache results for performance.
 */
export const calculateSimilarity = memoize((string1: string, string2: string): number => {
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

export function calculateFuzzyScore(filePath: string, searchTerm: string): number {
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

export function cleanFileName(text: string): string {
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

export function extractKeyTerms(text: string): string {
  if (!text) return "";
  const keyTermRegex = /([A-Z]+-?\d+-\d+)|([A-Z]+-?\d+)|(\d{3,})/g;
  const matches = text.match(keyTermRegex);
  return matches ? matches.join(' ') : cleanFileName(text);
}

/**
 * A highly optimized search index that pre-processes file paths
 * to enable near-instantaneous fuzzy searching with regex pattern support.
 */
export class SearchIndex {
  private allFilePaths: string[];
  private searchIndex: Map<string, Set<string>>;

  constructor(filePaths: string[]) {
    this.allFilePaths = filePaths;
    this.searchIndex = this.buildIndex(filePaths);
  }

  /**
   * Builds an inverted index from file paths to tokens.
   * This is the one-time cost that makes searches fast.
   */
  private buildIndex(filePaths: string[]): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    for (const path of filePaths) {
      // Create a comprehensive set of tokens from the path
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

  /**
   * Detects if search term contains regex patterns
   */
  private hasRegexPattern(searchTerm: string): boolean {
    return /[*?+\[\](){}|\\^$]/.test(searchTerm);
  }

  /**
   * Converts user-friendly patterns to regex
   * Examples: "Order No. *" -> /Order No\. (.+)/i
   */
  private createRegexFromPattern(pattern: string): RegExp {
    // Escape special regex characters except our wildcards
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\\\*/g, '(.*)') // Convert * to capture group
      .replace(/\\\?/g, '(.)'); // Convert ? to single char capture

    return new RegExp(regexPattern, 'i');
  }

  /**
   * Extracts sortable values from file paths using regex captures
   */
  private extractSortableValue(filePath: string, regex: RegExp): { value: string; sortKey: number | string } {
    const fileName = filePath.split('/').pop() || filePath;
    const match = fileName.match(regex);
    
    if (!match || !match[1]) {
      return { value: fileName, sortKey: fileName };
    }

    const capturedValue = match[1];
    
    // Try to extract numbers for numerical sorting
    const numberMatch = capturedValue.match(/(\d+)/);
    if (numberMatch) {
      return { 
        value: capturedValue, 
        sortKey: parseInt(numberMatch[1], 10) 
      };
    }

    // Fall back to string sorting
    return { value: capturedValue, sortKey: capturedValue };
  }

  /**
   * Applies regex filtering and sorting to search results
   */
  private applyRegexSorting(results: SearchResult[], pattern: string): SearchResult[] {
    const regex = this.createRegexFromPattern(pattern);
    
    // Filter results that match the regex pattern
    const regexMatches = results.filter(result => {
      const fileName = result.path.split('/').pop() || result.path;
      return regex.test(fileName);
    });

    // If no regex matches, return original results
    if (regexMatches.length === 0) {
      return results;
    }

    // Extract sortable values and sort
    const withSortKeys = regexMatches.map(result => ({
      ...result,
      sortData: this.extractSortableValue(result.path, regex)
    }));

    // Sort by the extracted values (numerical if possible, otherwise alphabetical)
    withSortKeys.sort((a, b) => {
      const aKey = a.sortData.sortKey;
      const bKey = b.sortData.sortKey;

      // Both are numbers - sort numerically
      if (typeof aKey === 'number' && typeof bKey === 'number') {
        return aKey - bKey;
      }

      // Both are strings - sort alphabetically
      if (typeof aKey === 'string' && typeof bKey === 'string') {
        return aKey.localeCompare(bKey);
      }

      // Mixed types - numbers first, then strings
      if (typeof aKey === 'number') return -1;
      if (typeof bKey === 'number') return 1;

      return 0;
    });

    // Return sorted results without the temporary sort data
    return withSortKeys.map(({ sortData, ...result }) => result);
  }

  /**
   * The application's core search function with regex pattern support.
   */
  public search(searchTerm: string, usedFilePaths: Set<string>): SearchResult[] {
    const availableFilePaths = this.allFilePaths.filter(path => !usedFilePaths.has(path));
    
    // Trim the search term to handle spaces properly
    const trimmedSearchTerm = searchTerm.trim();
    
    if (!trimmedSearchTerm) {
      return availableFilePaths.map(path => ({ path, score: 0 }));
    }

    // Check if this is a regex pattern search
    const isRegexPattern = this.hasRegexPattern(trimmedSearchTerm);
    
    if (isRegexPattern) {
      // For regex patterns, first do a broad fuzzy search to get candidates
      const basePattern = trimmedSearchTerm.replace(/[*?+\[\](){}|\\^$]/g, ''); // Remove regex chars for fuzzy search
      const cleanedSearchTerm = cleanFileName(basePattern);
      const keyTermsSearch = extractKeyTerms(basePattern);
      
      if (cleanedSearchTerm.trim() || keyTermsSearch.trim()) {
        // Get fuzzy search candidates first
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
          .slice(0, 100); // Get more candidates for regex filtering

        // Apply regex sorting using the trimmed search term
        return this.applyRegexSorting(fuzzyMatches, trimmedSearchTerm);
      } else {
        // Pure regex pattern without base text - search all files
        const allResults = availableFilePaths.map(path => ({ path, score: 0.5 }));
        return this.applyRegexSorting(allResults, trimmedSearchTerm);
      }
    }

    // Regular fuzzy search (existing logic)
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

/**
 * Convenience function for one-off searches without creating a persistent index.
 * For repeated searches on the same dataset, use the SearchIndex class directly.
 */
export function quickSearch(searchTerm: string, filePaths: string[], usedFilePaths: Set<string>): SearchResult[] {
  const searchIndex = new SearchIndex(filePaths);
  return searchIndex.search(searchTerm, usedFilePaths);
}