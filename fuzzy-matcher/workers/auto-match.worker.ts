// workers/auto-match.worker.ts - Auto Match Worker

import { FileReference } from '../lib/types';

// Import the same SearchIndex logic from search worker to avoid duplication
// We'll duplicate core functions for worker isolation

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

// Core matching algorithms (duplicated for worker isolation)
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

// Simplified SearchIndex for auto-matching
class AutoMatchSearchIndex {
  private allFilePaths: string[];
  private searchIndex: Map<string, Set<string>>;

  constructor(filePaths: string[]) {
    this.allFilePaths = filePaths;
    this.searchIndex = this.buildIndex(filePaths);
  }

  private buildIndex(filePaths: string[]): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    
    for (const path of filePaths) {
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

  public search(searchTerm: string, usedFilePaths: Set<string>) {
    const availableFilePaths = this.allFilePaths.filter(path => !usedFilePaths.has(path));
    const trimmedSearchTerm = searchTerm.trim();
    
    if (!trimmedSearchTerm) {
      return availableFilePaths.map(path => ({ path, score: 0 }));
    }

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
    return matches.slice(0, 10); // Limit results for auto-matching
  }
}

interface AutoMatchSuggestion {
  reference: FileReference;
  suggestedPath: string;
  score: number;
  isSelected: boolean;
  isAccepted?: boolean;
  isRejected?: boolean;
}

interface AutoMatchResult {
  suggestions: AutoMatchSuggestion[];
  totalReferences: number;
  suggestionsWithHighConfidence: number;
  suggestionsWithMediumConfidence: number;
  suggestionsWithLowConfidence: number;
}

// Auto-match generation function
function generateAutoMatchSuggestions(
  unmatchedReferences: FileReference[],
  availableFilePaths: string[],
  usedFilePaths: Set<string>
): AutoMatchResult {
  const suggestions: AutoMatchSuggestion[] = [];
  
  // Filter out already used file paths
  const unusedFilePaths = availableFilePaths.filter(path => !usedFilePaths.has(path));
  
  // Create search index for optimization
  const searchIndex = new AutoMatchSearchIndex(unusedFilePaths);
  
  // Track which paths we've already suggested to avoid duplicates
  const suggestedPaths = new Set<string>();
  
  // Sort references by complexity (more complex descriptions first)
  const sortedReferences = [...unmatchedReferences].sort((a, b) => {
    const aWords = a.description.split(/\s+/).length;
    const bWords = b.description.split(/\s+/).length;
    return bWords - aWords;
  });
  
  const totalRefs = sortedReferences.length;
  
  for (let i = 0; i < sortedReferences.length; i++) {
    const reference = sortedReferences[i];
    
    // Progress reporting
    if (i % 10 === 0 || i === totalRefs - 1) {
      self.postMessage({
        type: 'AUTO_MATCH_PROGRESS',
        progress: ((i + 1) / totalRefs) * 100,
        completed: i + 1,
        total: totalRefs,
        currentReference: reference.description.substring(0, 50) + '...'
      });
    }
    
    // Get search results for this reference
    const searchResults = searchIndex.search(
      reference.description,
      suggestedPaths
    );
    
    // Take the best match if it exists and has a reasonable score
    if (searchResults.length > 0 && searchResults[0].score > 0.15) {
      const bestMatch = searchResults[0];
      
      suggestions.push({
        reference,
        suggestedPath: bestMatch.path,
        score: bestMatch.score,
        isSelected: false
      });
      
      // Mark this path as suggested
      suggestedPaths.add(bestMatch.path);
    } else {
      // No good suggestion found
      suggestions.push({
        reference,
        suggestedPath: '',
        score: 0,
        isSelected: false
      });
    }
  }
  
  // Sort suggestions back to original order
  suggestions.sort((a, b) => {
    const aIndex = unmatchedReferences.findIndex(ref => ref.id === a.reference.id);
    const bIndex = unmatchedReferences.findIndex(ref => ref.id === b.reference.id);
    return aIndex - bIndex;
  });
  
  // Calculate confidence levels
  const withSuggestions = suggestions.filter(s => s.suggestedPath);
  const highConfidence = withSuggestions.filter(s => s.score > 0.7).length;
  const mediumConfidence = withSuggestions.filter(s => s.score >= 0.4 && s.score <= 0.7).length;
  const lowConfidence = withSuggestions.filter(s => s.score > 0 && s.score < 0.4).length;
  
  return {
    suggestions,
    totalReferences: unmatchedReferences.length,
    suggestionsWithHighConfidence: highConfidence,
    suggestionsWithMediumConfidence: mediumConfidence,
    suggestionsWithLowConfidence: lowConfidence
  };
}

// Message handler
self.onmessage = function(e) {
  const { type, id, data } = e.data;
  
  try {
    switch (type) {
      case 'GENERATE_AUTO_MATCH':
        const { unmatchedReferences, availableFilePaths, usedFilePaths } = data;
        const usedPathsSet = new Set(usedFilePaths);
        
        // Send start notification
        self.postMessage({
          type: 'AUTO_MATCH_STARTED',
          id,
          data: { totalReferences: unmatchedReferences.length }
        });
        
        const result = generateAutoMatchSuggestions(
          unmatchedReferences,
          availableFilePaths,
          usedPathsSet
        );
        
        self.postMessage({
          type: 'AUTO_MATCH_COMPLETE',
          id,
          data: result
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

self.addEventListener('unhandledrejection', function(event) {
  self.postMessage({
    type: 'WORKER_ERROR',
    error: {
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack
    }
  });
});