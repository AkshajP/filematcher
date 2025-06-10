// lib/auto-matcher.ts - Auto Match Logic

import { FileReference } from './types';
import { searchMatches } from './fuzzy-matcher';

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
 * Generates auto-match suggestions for all unmapped references
 */
export function generateAutoMatchSuggestions(
  unmatchedReferences: FileReference[],
  availableFilePaths: string[],
  usedFilePaths: Set<string>
): AutoMatchResult {
  const suggestions: AutoMatchSuggestion[] = [];
  
  // Filter out already used file paths
  const unusedFilePaths = availableFilePaths.filter(path => !usedFilePaths.has(path));
  
  // Track which paths we've already suggested to avoid duplicates
  const suggestedPaths = new Set<string>();
  
  // Sort references by complexity (more complex descriptions first)
  // This helps ensure better matches get first pick of similar files
  const sortedReferences = [...unmatchedReferences].sort((a, b) => {
    const aWords = a.description.split(/\s+/).length;
    const bWords = b.description.split(/\s+/).length;
    return bWords - aWords; // Descending order (more words first)
  });
  
  for (const reference of sortedReferences) {
    // Get search results for this reference
    const searchResults = searchMatches(
      reference.description,
      unusedFilePaths.filter(path => !suggestedPaths.has(path)), // Avoid duplicate suggestions
      new Set() // Empty set since we already filtered unusedFilePaths
    );
    
    // Take the best match if it exists and has a reasonable score
    if (searchResults.length > 0 && searchResults[0].score > 0.15) { // Slightly higher threshold
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
    const aIndex = unmatchedReferences.findIndex(ref => ref.description === a.reference.description);
    const bIndex = unmatchedReferences.findIndex(ref => ref.description === b.reference.description);
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