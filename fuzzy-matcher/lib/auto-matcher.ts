// lib/auto-matcher.ts - Auto Match Logic with Worker Integration

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
 * Worker-powered auto-match suggestions generator
 * Falls back to main thread if workers are unavailable
 */
export async function generateAutoMatchSuggestions(
  unmatchedReferences: FileReference[],
  availableFilePaths: string[],
  usedFilePaths: Set<string>,
  onProgress?: (data: any) => void
): Promise<AutoMatchResult> {
  // Try to use worker first
  try {
    const workerManager = getWorkerManager();
    return await workerManager.generateAutoMatch(
      unmatchedReferences,
      availableFilePaths,
      usedFilePaths,
      onProgress
    );
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
  // Import the SearchIndex here to avoid circular dependencies
  const { SearchIndex } = require('./fuzzy-matcher');
  
  const suggestions: AutoMatchSuggestion[] = [];
  
  // Filter out already used file paths
  const unusedFilePaths = availableFilePaths.filter(path => !usedFilePaths.has(path));
  
  // Create search index for optimization
  const searchIndex = new SearchIndex(unusedFilePaths);
  
  // Track which paths we've already suggested to avoid duplicates
  const suggestedPaths = new Set<string>();
  
  // Sort references by complexity (more complex descriptions first)
  const sortedReferences = [...unmatchedReferences].sort((a, b) => {
    const aWords = a.description.split(/\s+/).length;
    const bWords = b.description.split(/\s+/).length;
    return bWords - aWords; // Descending order (more words first)
  });
  
  const totalRefs = sortedReferences.length;
  
  for (let i = 0; i < sortedReferences.length; i++) {
    const reference = sortedReferences[i];
    
    // Progress reporting for main thread
    if (onProgress && (i % 10 === 0 || i === totalRefs - 1)) {
      onProgress({
        type: 'AUTO_MATCH_PROGRESS',
        progress: ((i + 1) / totalRefs) * 100,
        completed: i + 1,
        total: totalRefs,
        currentReference: reference.description.substring(0, 50) + '...'
      });
    }
    
    // Get available paths for this reference (excluding already suggested ones)
    const availablePaths = unusedFilePaths.filter(path => !suggestedPaths.has(path));
    
    // Get search results for this reference using the optimized search index
    const searchResults = searchIndex.search(
      reference.description,
      suggestedPaths // Pass already suggested paths as "used" to avoid duplicates
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
      
      // Mark this path as suggested so we don't suggest it for another reference
      suggestedPaths.add(bestMatch.path);
    } else {
      // No good suggestion found, add with empty path and 0 score
      suggestions.push({
        reference,
        suggestedPath: '',
        score: 0,
        isSelected: false
      });
    }
  }
  
  // Sort suggestions back to original order (by reference order)
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

/**
 * Filters suggestions based on minimum confidence threshold
 */
export function filterSuggestionsByConfidence(
  suggestions: AutoMatchSuggestion[],
  minScore: number = 0.4
): AutoMatchSuggestion[] {
  return suggestions.filter(s => s.score >= minScore && s.suggestedPath);
}

/**
 * Selects all suggestions above a certain confidence level
 */
export function selectHighConfidenceSuggestions(
  suggestions: AutoMatchSuggestion[],
  minScore: number = 0.7
): AutoMatchSuggestion[] {
  return suggestions.map(suggestion => ({
    ...suggestion,
    isSelected: suggestion.score >= minScore && suggestion.suggestedPath !== ''
  }));
}