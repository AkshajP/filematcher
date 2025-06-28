// fuzzy-matcher/lib/auto-matcher.ts - Update auto-match types and functions for referenceId

import { FileReference, MatchedPair, generateUniqueId } from './types';

export interface AutoMatchSuggestion {
  reference: FileReference; // Changed from simple object to full FileReference
  suggestedPath: string;
  score: number;
  method: 'fuzzy' | 'exact' | 'pattern';
  isSelected?: boolean;
  isAccepted?: boolean;
  isRejected?: boolean;
}

export interface AutoMatchResult {
  suggestions: AutoMatchSuggestion[];
  totalProcessed: number;
  suggestionsWithHighConfidence: number;
  suggestionsWithMediumConfidence: number;
  suggestionsWithLowConfidence: number;
  unmatchedReferences: FileReference[];
}

/**
 * Convert auto-match suggestions to matched pairs with proper referenceId
 */
export function convertSuggestionsToMatchedPairs(
  acceptedSuggestions: AutoMatchSuggestion[],
  sessionId: string
): MatchedPair[] {
  return acceptedSuggestions.map(suggestion => {
    // Ensure the reference has an ID
    if (!suggestion.reference.id) {
      console.error('AutoMatch suggestion reference missing ID:', suggestion.reference);
      suggestion.reference.id = generateUniqueId();
    }

    return {
      id: generateUniqueId(),
      referenceId: suggestion.reference.id, // Use the reference's unique ID
      reference: suggestion.reference.description,
      path: suggestion.suggestedPath,
      score: suggestion.score,
      timestamp: new Date().toISOString(),
      method: 'auto',
      sessionId,
      originalDate: suggestion.reference.date,
      originalReference: suggestion.reference.reference,
    };
  });
}

/**
 * Basic auto-match implementation (placeholder - implement your matching logic)
 */
export function performAutoMatch(
  unmatchedReferences: FileReference[],
  availableFilePaths: string[]
): AutoMatchResult {
  const suggestions: AutoMatchSuggestion[] = [];
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;

  unmatchedReferences.forEach(reference => {
    // Ensure reference has an ID
    if (!reference.id) {
      reference.id = generateUniqueId();
    }

    // Simple fuzzy matching logic (replace with your actual implementation)
    const bestMatch = findBestMatch(reference, availableFilePaths);
    
    if (bestMatch) {
      suggestions.push({
        reference, // Pass full FileReference object
        suggestedPath: bestMatch.path,
        score: bestMatch.score,
        method: bestMatch.method as 'fuzzy' | 'exact' | 'pattern',
        isSelected: false,
        isAccepted: false,
        isRejected: false
      });

      // Count confidence levels
      if (bestMatch.score >= 0.7) {
        highConfidence++;
      } else if (bestMatch.score >= 0.4) {
        mediumConfidence++;
      } else {
        lowConfidence++;
      }
    }
  });

  return {
    suggestions,
    totalProcessed: unmatchedReferences.length,
    suggestionsWithHighConfidence: highConfidence,
    suggestionsWithMediumConfidence: mediumConfidence,
    suggestionsWithLowConfidence: lowConfidence,
    unmatchedReferences: unmatchedReferences.filter(ref => 
      !suggestions.some(s => s.reference.id === ref.id)
    )
  };
}

// Simple matching function (placeholder - implement your actual logic)
function findBestMatch(
  reference: FileReference, 
  filePaths: string[]
): { path: string; score: number; method: string } | null {
  const description = reference.description.toLowerCase();
  let bestMatch: { path: string; score: number; method: string } | null = null;

  filePaths.forEach(filePath => {
    const fileName = filePath.split('/').pop()?.toLowerCase() || '';
    
    // Simple scoring based on filename similarity
    let score = 0;
    let method = 'fuzzy';

    if (fileName.includes(description) || description.includes(fileName)) {
      score = 0.8;
      method = 'exact';
    } else {
      // Simple word matching
      const descWords = description.split(/\s+/);
      const fileWords = fileName.replace(/[._-]/g, ' ').split(/\s+/);
      
      const matchingWords = descWords.filter(word => 
        fileWords.some(fileWord => 
          fileWord.includes(word) || word.includes(fileWord)
        )
      );
      
      score = matchingWords.length / Math.max(descWords.length, fileWords.length);
    }

    if (score > (bestMatch?.score || 0)) {
      bestMatch = { path: filePath, score, method };
    }
  });

  return bestMatch && bestMatch.score > 0.3 ? bestMatch : null;
}