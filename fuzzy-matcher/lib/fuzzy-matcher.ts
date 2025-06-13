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


/**
 * The rest of the functions from the original file remain unchanged as their logic is sound.
 * calculateFuzzyScore, cleanFileName, and extractKeyTerms are used by the new SearchIndex class.
 */
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
 * to enable near-instantaneous fuzzy searching.
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
   * The application's core search function, now highly optimized.
   */
  public search(searchTerm: string, usedFilePaths: Set<string>): SearchResult[] {
    const availableFilePaths = this.allFilePaths.filter(path => !usedFilePaths.has(path));
    
    if (!searchTerm.trim()) {
      return availableFilePaths.map(path => ({ path, score: 0 }));
    }
    
    // 1. Get a small list of candidate paths from the index
    const cleanedSearchTerm = cleanFileName(searchTerm);
    const keyTermsSearch = extractKeyTerms(searchTerm);
    const searchTokens = new Set([
        ...cleanedSearchTerm.split(' '),
        ...keyTermsSearch.toLowerCase().split(' ')
    ].filter(t => t.length > 1));
    
    const candidatePaths = new Set<string>();
    for (const token of searchTokens) {
        // Find all index keys that contain the search token for fuzzy matching
        for (const [indexKey, paths] of this.searchIndex.entries()) {
            if(indexKey.includes(token)) {
                paths.forEach(path => candidatePaths.add(path));
            }
        }
    }

    // 2. Run scoring only on the candidates (and filter out used paths)
    const matches = Array.from(candidatePaths)
      .filter(path => !usedFilePaths.has(path))
      .map(filePath => {
        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const cleanedFileName = cleanFileName(fileName);
        
        const originalScore = calculateFuzzyScore(filePath, searchTerm);
        const cleanedScore = calculateFuzzyScore(cleanedFileName, cleanedSearchTerm);
        const keyTermsScore = calculateFuzzyScore(filePath, keyTermsSearch);
        
        return {
          path: filePath,
          score: Math.max(originalScore, cleanedScore, keyTermsScore)
        };
      })
      .filter(item => item.score > 0.05);
      
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 50); // Return top 50 for performance
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