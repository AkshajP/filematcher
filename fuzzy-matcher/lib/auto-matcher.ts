// lib/auto-matcher.ts - Enhanced Auto Match Logic with Robust Error Handling

import { FileReference } from './types';
import { getWorkerManager } from './worker-manager';

export interface AutoMatchSuggestion {
  reference: FileReference;
  suggestedPath: string;
  score: number;
  isSelected: boolean;
  isAccepted?: boolean;
  isRejected?: boolean;
}

export interface AutoMatchResult {
  suggestions: AutoMatchSuggestion[];
  totalReferences: number;
  suggestionsWithHighConfidence: number; // > 70%
  suggestionsWithMediumConfidence: number; // 40-70%
  suggestionsWithLowConfidence: number; // < 40%
}

/**
 * Validates the structure of an AutoMatchResult
 */
function validateAutoMatchResult(result: any): AutoMatchResult {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid auto-match result: not an object');
  }

  // Ensure suggestions is an array
  if (!Array.isArray(result.suggestions)) {
    console.warn('Auto-match result missing suggestions array, creating empty array');
    result.suggestions = [];
  }

  // Validate each suggestion
  result.suggestions = result.suggestions.filter((suggestion: any) => {
    if (!suggestion || typeof suggestion !== 'object') {
      console.warn('Invalid suggestion object, filtering out');
      return false;
    }

    // Ensure required properties exist
    if (!suggestion.reference || typeof suggestion.suggestedPath !== 'string') {
      console.warn('Suggestion missing required properties, filtering out');
      return false;
    }

    // Set defaults for missing properties
    if (typeof suggestion.score !== 'number') {
      suggestion.score = 0;
    }
    if (typeof suggestion.isSelected !== 'boolean') {
      suggestion.isSelected = false;
    }

    return true;
  });

  // Set defaults for numeric properties
  const totalReferences = typeof result.totalReferences === 'number' ? result.totalReferences : 0;
  const highConfidence = typeof result.suggestionsWithHighConfidence === 'number' ? result.suggestionsWithHighConfidence : 0;
  const mediumConfidence = typeof result.suggestionsWithMediumConfidence === 'number' ? result.suggestionsWithMediumConfidence : 0;
  const lowConfidence = typeof result.suggestionsWithLowConfidence === 'number' ? result.suggestionsWithLowConfidence : 0;

  return {
    suggestions: result.suggestions,
    totalReferences,
    suggestionsWithHighConfidence: highConfidence,
    suggestionsWithMediumConfidence: mediumConfidence,
    suggestionsWithLowConfidence: lowConfidence,
  };
}

/**
 * Creates an empty AutoMatchResult for error cases
 */
function createEmptyResult(totalReferences: number = 0): AutoMatchResult {
  return {
    suggestions: [],
    totalReferences,
    suggestionsWithHighConfidence: 0,
    suggestionsWithMediumConfidence: 0,
    suggestionsWithLowConfidence: 0,
  };
}

/**
 * Worker-powered auto-match suggestions generator
 * Falls back to main thread if workers are unavailable
 */
export async function generateAutoMatchSuggestions(
  unmatchedReferences: FileReference[],
  availableFilePaths: string[],
  usedFilePaths: Set<string>,
  onProgress?: (data: any) => void
): Promise<AutoMatchResult> {
  // Input validation
  if (!Array.isArray(unmatchedReferences)) {
    console.error('generateAutoMatchSuggestions: unmatchedReferences is not an array');
    return createEmptyResult();
  }

  if (!Array.isArray(availableFilePaths)) {
    console.error('generateAutoMatchSuggestions: availableFilePaths is not an array');
    return createEmptyResult(unmatchedReferences.length);
  }

  if (unmatchedReferences.length === 0) {
    console.log('No unmatched references to process');
    return createEmptyResult();
  }

  if (availableFilePaths.length === 0) {
    console.log('No available file paths to match against');
    return createEmptyResult(unmatchedReferences.length);
  }

  // Try to use worker first
  try {
    console.log(`Starting auto-match for ${unmatchedReferences.length} references against ${availableFilePaths.length} paths`);
    
    const workerManager = getWorkerManager();
    const result = await workerManager.generateAutoMatch(
      unmatchedReferences,
      availableFilePaths,
      usedFilePaths,
      onProgress
    );
    
    // Validate and sanitize the result
    const validatedResult = validateAutoMatchResult(result);
    
    console.log(`Auto-match completed: ${validatedResult.suggestions.length} suggestions generated`);
    return validatedResult;
    
  } catch (error) {
    console.warn('Worker auto-match failed, falling back to main thread:', error);
    return generateAutoMatchSuggestionsMainThread(
      unmatchedReferences,
      availableFilePaths,
      usedFilePaths,
      onProgress
    );
  }
}

/**
 * Main thread fallback implementation
 * This is the original implementation that runs on the main thread
 */
function generateAutoMatchSuggestionsMainThread(
  unmatchedReferences: FileReference[],
  availableFilePaths: string[],
  usedFilePaths: Set<string>,
  onProgress?: (data: any) => void
): AutoMatchResult {
  console.log('Auto-match running on main thread (fallback)');
  
  try {
    // Filter available paths
    const filteredPaths = availableFilePaths.filter(path => !usedFilePaths.has(path));
    
    if (filteredPaths.length === 0) {
      console.log('No available file paths after filtering used paths');
      return createEmptyResult(unmatchedReferences.length);
    }

    const suggestions: AutoMatchSuggestion[] = unmatchedReferences.map((reference, index) => {
      // Send progress updates
      if (onProgress && index % Math.max(1, Math.floor(unmatchedReferences.length / 20)) === 0) {
        onProgress({
          type: 'AUTO_MATCH_PROGRESS',
          progress: (index / unmatchedReferences.length) * 100,
          currentReference: reference.description
        });
      }
      
      let bestMatch = '';
      let bestScore = 0;
      
      // Simple similarity matching
      for (const filePath of filteredPaths) {
        const score = calculateSimilarity(reference.description, filePath);
        if (score > bestScore && score > 0.2) { // Lower threshold for main thread
          bestScore = score;
          bestMatch = filePath;
        }
      }
      
      return {
        reference,
        suggestedPath: bestMatch,
        score: bestScore,
        isSelected: bestScore > 0.6, // Auto-select good matches
        isAccepted: false,
        isRejected: false
      };
    });

    // Send final progress
    if (onProgress) {
      onProgress({
        type: 'AUTO_MATCH_PROGRESS',
        progress: 100,
        currentReference: 'Complete'
      });
    }

    // Filter suggestions with matches
    const withSuggestions = suggestions.filter(s => s.suggestedPath);
    
    // Calculate confidence levels
    const highConfidence = withSuggestions.filter(s => s.score > 0.7).length;
    const mediumConfidence = withSuggestions.filter(s => s.score >= 0.4 && s.score <= 0.7).length;
    const lowConfidence = withSuggestions.filter(s => s.score > 0 && s.score < 0.4).length;
    
    const result: AutoMatchResult = {
      suggestions,
      totalReferences: unmatchedReferences.length,
      suggestionsWithHighConfidence: highConfidence,
      suggestionsWithMediumConfidence: mediumConfidence,
      suggestionsWithLowConfidence: lowConfidence
    };

    console.log(`Main thread auto-match completed: ${withSuggestions.length}/${suggestions.length} suggestions with matches`);
    return result;

  } catch (error) {
    console.error('Main thread auto-match failed:', error);
    return createEmptyResult(unmatchedReferences.length);
  }
}

/**
 * Calculate similarity between two strings (simplified version)
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const str1 = text1.toLowerCase().trim();
  const str2 = text2.toLowerCase().trim();
  
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.85;
  
  // Word-based matching
  const words1 = str1.split(/[\s\/\-_\.]+/).filter(w => w.length > 2);
  const words2 = str2.split(/[\s\/\-_\.]+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  let matchCount = 0;
  const totalWords = Math.max(words1.length, words2.length);
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.length > 2 && word2.length > 2) {
        if (word1 === word2) {
          matchCount += 1.0;
          break;
        } else if (word1.includes(word2) || word2.includes(word1)) {
          matchCount += 0.7;
          break;
        } else if (levenshteinDistance(word1, word2) <= 2) {
          matchCount += 0.5;
          break;
        }
      }
    }
  }
  
  return Math.min(1.0, matchCount / totalWords);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}