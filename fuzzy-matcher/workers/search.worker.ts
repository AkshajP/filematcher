// workers/search.worker.ts - Debug Enhanced Search Worker

console.log('🔍 Search worker script loaded');

import { SearchResult } from '../lib/types';

// Memoization function
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

// Core similarity calculation (memoized for performance)
const calculateSimilarity = memoize((searchTerm: string, filePath: string): number => {
  if (!searchTerm || !filePath) return 0;
  
  const search = searchTerm.toLowerCase();
  const path = filePath.toLowerCase();
  
  // Exact match
  if (path.includes(search)) return 1.0;
  
  // Word-based matching
  const searchWords = search.split(/[\s\/\-_\.]+/).filter(word => word.length > 2);
  const pathWords = path.split(/[\s\/\-_\.]+/).filter(word => word.length > 2);
  
  if (searchWords.length === 0) return 0;
  
  let score = 0;
  let matchedWords = 0;
  
  for (const searchWord of searchWords) {
    let bestWordScore = 0;
    
    for (const pathWord of pathWords) {
      if (pathWord.includes(searchWord)) {
        bestWordScore = Math.max(bestWordScore, 0.9);
      } else if (searchWord.includes(pathWord)) {
        bestWordScore = Math.max(bestWordScore, 0.7);
      } else {
        // Levenshtein-like partial matching for typos
        const longer = searchWord.length > pathWord.length ? searchWord : pathWord;
        const shorter = searchWord.length > pathWord.length ? pathWord : searchWord;
        
        if (longer.includes(shorter) && shorter.length > 2) {
          bestWordScore = Math.max(bestWordScore, 0.5);
        }
      }
    }
    
    if (bestWordScore > 0) {
      matchedWords++;
      score += bestWordScore;
    }
  }
  
  return matchedWords > 0 ? (score / searchWords.length) * (matchedWords / searchWords.length) : 0;
});

/**
 * Search Index class for worker
 */
class SearchIndex {
  private filePaths: string[] = [];
  
  constructor(filePaths: string[]) {
    console.log(`🔍 Worker: Creating SearchIndex with ${filePaths.length} file paths`);
    this.filePaths = filePaths;
    console.log('🔍 Worker: SearchIndex created successfully');
  }
  
  search(searchTerm: string, usedFilePaths: Set<string>, maxResults: number = 50): SearchResult[] {
    console.log(`🔍 Worker: Searching for "${searchTerm}" (excluding ${usedFilePaths.size} used paths)`);
    
    if (!searchTerm || searchTerm.trim().length === 0) {
      console.log('🔍 Worker: Empty search term, returning empty results');
      return [];
    }
    
    const trimmedSearchTerm = searchTerm.trim();
    const availablePaths = this.filePaths.filter(path => !usedFilePaths.has(path));
    
    console.log(`🔍 Worker: Searching ${availablePaths.length}/${this.filePaths.length} available paths`);
    
    const results: SearchResult[] = [];
    
    for (const filePath of availablePaths) {
      const similarity = calculateSimilarity(trimmedSearchTerm, filePath);
      
      if (similarity > 0.1) { // Minimum threshold
        results.push({
          path: filePath,
          score: similarity
        });
      }
    }
    
    // Sort by score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, maxResults);
    
    console.log(`🔍 Worker: Found ${results.length} matches, returning top ${limitedResults.length}`);
    
    return limitedResults;
  }
  
  updateIndex(filePaths: string[]): void {
    console.log(`🔍 Worker: Updating index with ${filePaths.length} file paths`);
    this.filePaths = filePaths;
    console.log('🔍 Worker: Index updated successfully');
  }
}

// Global search index instance
let searchIndex: SearchIndex | null = null;

// Message handler with enhanced debugging
self.onmessage = function(e) {
  console.log('🔍 Worker: Received message:', {
    messageType: typeof e.data,
    hasType: !!e.data?.type,
    hasId: !!e.data?.id,
    hasData: !!e.data?.data,
    fullMessage: e.data
  });

  const { type, id, data } = e.data;
  
  if (!type) {
    console.error('🔍 Worker: Message missing type field');
    self.postMessage({
      type: 'ERROR',
      id,
      error: 'Message missing type field'
    });
    return;
  }

  if (!id) {
    console.error('🔍 Worker: Message missing id field');
    self.postMessage({
      type: 'ERROR',
      error: 'Message missing id field'
    });
    return;
  }

  try {
    console.log(`🔍 Worker: Processing message type: ${type}`);
    
    switch (type) {
      case 'INITIALIZE_INDEX':
        console.log('🔍 Worker: Handling INITIALIZE_INDEX request');
        
        if (!data || !Array.isArray(data.filePaths)) {
          console.error('🔍 Worker: INITIALIZE_INDEX missing valid filePaths array');
          throw new Error('Missing valid filePaths array');
        }
        
        console.log(`🔍 Worker: Initializing index with ${data.filePaths.length} file paths`);
        
        if (searchIndex) {
          console.log('🔍 Worker: Updating existing search index');
          searchIndex.updateIndex(data.filePaths);
        } else {
          console.log('🔍 Worker: Creating new search index');
          searchIndex = new SearchIndex(data.filePaths);
        }
        
        console.log('🔍 Worker: Sending INITIALIZE_COMPLETE response');
        self.postMessage({
          type: 'INITIALIZE_COMPLETE',
          id,
          data: { 
            success: true,
            indexedPaths: data.filePaths.length
          }
        });
        break;
        
      case 'SEARCH':
        console.log('🔍 Worker: Handling SEARCH request');
        
        if (!searchIndex) {
          console.error('🔍 Worker: Search index not initialized');
          throw new Error('Search index not initialized');
        }
        
        if (!data) {
          console.error('🔍 Worker: SEARCH message missing data');
          throw new Error('Missing search data');
        }
        
        const { searchTerm, usedFilePaths } = data;
        
        console.log('🔍 Worker: Search parameters:', {
          searchTermType: typeof searchTerm,
          searchTermLength: searchTerm?.length,
          usedFilePathsType: typeof usedFilePaths,
          usedFilePathsLength: usedFilePaths?.length
        });
        
        if (!searchTerm || typeof searchTerm !== 'string') {
          console.error('🔍 Worker: Invalid search term');
          throw new Error('Invalid search term');
        }
        
        // Convert usedFilePaths array back to Set
        const usedPathsSet = new Set(Array.isArray(usedFilePaths) ? usedFilePaths : []);
        console.log(`🔍 Worker: Converted usedFilePaths to Set with ${usedPathsSet.size} items`);
        
        console.log('🔍 Worker: Performing search...');
        const results = searchIndex.search(searchTerm, usedPathsSet);
        
        console.log(`🔍 Worker: Search completed, found ${results.length} results`);
        console.log('🔍 Worker: Sending SEARCH_COMPLETE response');
        
        self.postMessage({
          type: 'SEARCH_COMPLETE',
          id,
          data: { 
            results: results,
            searchTerm: searchTerm,
            resultCount: results.length
          }
        });
        break;
        
      default:
        console.error(`🔍 Worker: Unknown message type: ${type}`);
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('🔍 Worker: Error processing message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    self.postMessage({
      type: 'ERROR',
      id,
      error: errorMessage
    });
  }
};

// Global error handling
self.onerror = function(error) {
  console.error('🔍 Worker: Global error:', {
    message: error.message,
    filename: error.filename,
    lineno: error.lineno,
    colno: error.colno
  });
  
  self.postMessage({
    type: 'WORKER_ERROR',
    error: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno
    }
  });
};

self.addEventListener('unhandledrejection', function(event) {
  console.error('🔍 Worker: Unhandled promise rejection:', event.reason);
  
  self.postMessage({
    type: 'WORKER_ERROR',
    error: {
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack
    }
  });
});

console.log('🔍 Search worker fully initialized and ready');