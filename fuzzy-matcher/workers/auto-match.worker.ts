// workers/auto-match.worker.ts - Debug Enhanced Auto Match Worker

import { FileReference } from '../lib/types';

console.log('🤖 Auto-match worker script loaded');

// Import the same SearchIndex logic from search worker to avoid duplication
// We'll duplicate core functions for worker isolation

// Size-limited cache instead of unlimited memoization
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 10000) { // Limit to 10k entries
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (mark as recently used)
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  size(): number {
    return this.cache.size;
  }
}

// Create a size-limited cache for similarity calculations
const similarityCache = new LRUCache<string, number>(5000); // Limit to 5k cached calculations

// Optimized similarity calculation with limited caching
function calculateSimilarity(string1: string, string2: string): number {
  if (!string1 || !string2) return 0;
  
  // Create a shorter cache key to save memory
  const key = `${string1.slice(0, 50)}:${string2.slice(0, 50)}`;
  
  // Check cache first
  const cached = similarityCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  
  const str1 = string1.toLowerCase();
  const str2 = string2.toLowerCase();
  
  let result = 0;
  
  if (str1 === str2) {
    result = 1.0;
  } else if (str1.includes(str2)) {
    result = 0.9;
  } else if (str2.includes(str1)) {
    result = 0.85;
  } else {
    // Word-based matching
    const words1 = str1.split(/[\s\/\-_\.]+/).filter(w => w.length > 2);
    const words2 = str2.split(/[\s\/\-_\.]+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) {
      result = 0;
    } else {
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
            }
          }
        }
      }
      
      result = Math.min(1.0, matchCount / totalWords);
    }
  }
  
  // Cache the result
  similarityCache.set(key, result);
  
  return result;
}

function generateAutoMatchSuggestions(
  unmatchedReferences: FileReference[],
  availableFilePaths: string[],
  usedPathsSet: Set<string>
): any {
  console.log('🤖 Worker: generateAutoMatchSuggestions called with:', {
    unmatchedReferencesCount: unmatchedReferences?.length || 0,
    availableFilePathsCount: availableFilePaths?.length || 0,
    usedPathsSetSize: usedPathsSet?.size || 0
  });

  try {
    // Input validation
    if (!Array.isArray(unmatchedReferences)) {
      console.error('🤖 Worker: unmatchedReferences is not an array:', typeof unmatchedReferences);
      throw new Error('unmatchedReferences must be an array');
    }

    if (!Array.isArray(availableFilePaths)) {
      console.error('🤖 Worker: availableFilePaths is not an array:', typeof availableFilePaths);
      throw new Error('availableFilePaths must be an array');
    }

    if (!(usedPathsSet instanceof Set)) {
      console.error('🤖 Worker: usedPathsSet is not a Set:', typeof usedPathsSet);
      throw new Error('usedPathsSet must be a Set');
    }

    console.log('🤖 Worker: Input validation passed');

    // Filter available paths
    const filteredPaths = availableFilePaths.filter(path => !usedPathsSet.has(path));
    console.log(`🤖 Worker: Filtered ${filteredPaths.length}/${availableFilePaths.length} available paths`);

    if (filteredPaths.length === 0) {
      console.warn('🤖 Worker: No available paths after filtering');
      const emptyResult = {
        suggestions: [],
        totalReferences: unmatchedReferences.length,
        suggestionsWithHighConfidence: 0,
        suggestionsWithMediumConfidence: 0,
        suggestionsWithLowConfidence: 0
      };
      console.log('🤖 Worker: Returning empty result:', emptyResult);
      return emptyResult;
    }

    console.log('🤖 Worker: Starting matching process...');
    console.log('🤖 Worker: Sample reference:', unmatchedReferences[0]);
    console.log('🤖 Worker: Sample file path:', filteredPaths[0]);
    
    // Initialize suggestions array
    const suggestions: any[] = [];
    console.log('🤖 Worker: Initialized suggestions array');
    
    // Process each reference
    for (let index = 0; index < unmatchedReferences.length; index++) {
      const reference = unmatchedReferences[index];
      
      if (index % 100 === 0) {
        console.log(`🤖 Worker: Processing reference ${index + 1}/${unmatchedReferences.length}: "${reference.description}"`);
      }

      // Send progress updates every 10% of references
      if (index % Math.max(1, Math.floor(unmatchedReferences.length / 10)) === 0) {
        const progressData = {
          type: 'AUTO_MATCH_PROGRESS',
          progress: (index / unmatchedReferences.length) * 100,
          currentReference: reference.description
        };
        
        console.log(`🤖 Worker: Sending progress update: ${progressData.progress.toFixed(1)}%`);
        
        try {
          self.postMessage({
            type: 'AUTO_MATCH_PROGRESS',
            data: progressData
          });
        } catch (error) {
          console.error('🤖 Worker: Failed to send progress update:', error);
        }
      }
      
      let bestMatch = '';
      let bestScore = 0;
      
      // Find best match for this reference
      try {
        let calculations = 0;
        for (const filePath of filteredPaths) {
          calculations++;
          const score = calculateSimilarity(reference.description, filePath);
          if (score > bestScore && score > 0.4) { // 40% minimum threshold
            bestScore = score;
            bestMatch = filePath;
          }
        }
        
        // Log cache performance periodically
        if (index % 500 === 0) {
          console.log(`🤖 Worker: Reference ${index} - Cache size: ${similarityCache.size()}, Calculations: ${calculations}`);
        }
      } catch (scoreError) {
        console.error(`🤖 Worker: Error calculating scores for reference ${index}:`, scoreError);
        console.error(`🤖 Worker: Cache size at error: ${similarityCache.size()}`);
        // Continue with no match for this reference
      }
      
      const suggestion = {
        reference,
        suggestedPath: bestMatch,
        score: bestScore,
        isSelected: bestScore > 0.7, // Auto-select high confidence matches
        isAccepted: false,
        isRejected: false
      };

      try {
        suggestions.push(suggestion);
        
        if (index < 3) {
          console.log(`🤖 Worker: Sample suggestion ${index}:`, suggestion);
        }
      } catch (pushError) {
        console.error(`🤖 Worker: Error pushing suggestion ${index}:`, pushError);
        // Continue processing other references
      }
    }

    console.log(`🤖 Worker: Generated ${suggestions.length} suggestions`);
    console.log('🤖 Worker: suggestions array type:', typeof suggestions);
    console.log('🤖 Worker: suggestions is array:', Array.isArray(suggestions));

    // Validate suggestions array immediately after generation
    if (!Array.isArray(suggestions)) {
      console.error('🤖 Worker: CRITICAL - suggestions is not an array after generation!');
      console.error('🤖 Worker: suggestions type:', typeof suggestions);
      console.error('🤖 Worker: suggestions value:', suggestions);
      throw new Error('Suggestions array generation failed');
    }

    // Filter suggestions with matches
    const withSuggestions = suggestions.filter(s => s && s.suggestedPath);
    console.log(`🤖 Worker: ${withSuggestions.length}/${suggestions.length} suggestions have matches`);

    // Calculate confidence levels
    const highConfidence = withSuggestions.filter(s => s.score > 0.7).length;
    const mediumConfidence = withSuggestions.filter(s => s.score >= 0.4 && s.score <= 0.7).length;
    const lowConfidence = withSuggestions.filter(s => s.score > 0 && s.score < 0.4).length;

    const result = {
      suggestions: suggestions,  // Explicitly assign
      totalReferences: unmatchedReferences.length,
      suggestionsWithHighConfidence: highConfidence,
      suggestionsWithMediumConfidence: mediumConfidence,
      suggestionsWithLowConfidence: lowConfidence
    };

    console.log('🤖 Worker: Pre-validation result structure:', {
      hasResult: !!result,
      resultType: typeof result,
      resultKeys: Object.keys(result),
      suggestionsType: typeof result.suggestions,
      suggestionsIsArray: Array.isArray(result.suggestions),
      suggestionsLength: result.suggestions?.length,
      totalReferences: result.totalReferences
    });

    // Validate result structure before returning
    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      console.error('🤖 Worker: CRITICAL - Result validation failed!');
      console.error('🤖 Worker: result.suggestions type:', typeof result.suggestions);
      console.error('🤖 Worker: result.suggestions value:', result.suggestions);
      console.error('🤖 Worker: Full result:', result);
      throw new Error('Result validation failed: suggestions is not an array');
    }

    console.log('🤖 Worker: Result validation passed');
    console.log('🤖 Worker: Final result summary:', {
      suggestionsCount: result.suggestions.length,
      totalReferences: result.totalReferences,
      highConfidence: result.suggestionsWithHighConfidence,
      mediumConfidence: result.suggestionsWithMediumConfidence,
      lowConfidence: result.suggestionsWithLowConfidence
    });

    return result;

  } catch (error) {
    console.error('🤖 Worker: CRITICAL ERROR in generateAutoMatchSuggestions:', error);
    console.error('🤖 Worker: Error stack:', error.stack);
    console.error('🤖 Worker: Error occurred at suggestions array length:', suggestions?.length);
    console.error('🤖 Worker: Current suggestions array type:', typeof suggestions);
    console.error('🤖 Worker: Current suggestions array:', suggestions);
    
    // Return a safe fallback result
    const fallbackResult = {
      suggestions: [],
      totalReferences: unmatchedReferences?.length || 0,
      suggestionsWithHighConfidence: 0,
      suggestionsWithMediumConfidence: 0,
      suggestionsWithLowConfidence: 0
    };
    
    console.log('🤖 Worker: Created fallback result:', fallbackResult);
    console.log('🤖 Worker: Fallback result suggestions type:', typeof fallbackResult.suggestions);
    console.log('🤖 Worker: Fallback result suggestions is array:', Array.isArray(fallbackResult.suggestions));
    
    return fallbackResult;
  }
}

// Message handler with enhanced debugging
self.onmessage = function(e) {
  console.log('🤖 Worker: Received message:', {
    messageType: typeof e.data,
    hasType: !!e.data?.type,
    hasId: !!e.data?.id,
    hasData: !!e.data?.data,
    fullMessage: e.data
  });

  const { type, id, data } = e.data;
  
  if (!type) {
    console.error('🤖 Worker: Message missing type field');
    self.postMessage({
      type: 'ERROR',
      id,
      error: 'Message missing type field'
    });
    return;
  }

  if (!id) {
    console.error('🤖 Worker: Message missing id field');
    self.postMessage({
      type: 'ERROR',
      error: 'Message missing id field'
    });
    return;
  }

  try {
    console.log(`🤖 Worker: Processing message type: ${type}`);
    
    switch (type) {
      case 'GENERATE_AUTO_MATCH':
        console.log('🤖 Worker: Handling GENERATE_AUTO_MATCH request');
        
        if (!data) {
          console.error('🤖 Worker: GENERATE_AUTO_MATCH message missing data');
          throw new Error('Message missing data field');
        }

        const { unmatchedReferences, availableFilePaths, usedFilePaths } = data;
        
        console.log('🤖 Worker: Extracted data:', {
          unmatchedReferencesType: typeof unmatchedReferences,
          unmatchedReferencesLength: unmatchedReferences?.length,
          availableFilePathsType: typeof availableFilePaths,
          availableFilePathsLength: availableFilePaths?.length,
          usedFilePathsType: typeof usedFilePaths,
          usedFilePathsLength: usedFilePaths?.length
        });

        // Convert usedFilePaths array back to Set
        const usedPathsSet = new Set(usedFilePaths);
        console.log(`🤖 Worker: Converted usedFilePaths array to Set with ${usedPathsSet.size} items`);
        
        // Send start notification
        console.log('🤖 Worker: Sending AUTO_MATCH_STARTED notification');
        self.postMessage({
          type: 'AUTO_MATCH_STARTED',
          id,
          data: { totalReferences: unmatchedReferences?.length || 0 }
        });
        
        console.log('🤖 Worker: About to call generateAutoMatchSuggestions...');
        console.log('🤖 Worker: Function exists:', typeof generateAutoMatchSuggestions);
        console.log('🤖 Worker: Parameters check:', {
          unmatchedReferencesType: typeof unmatchedReferences,
          unmatchedReferencesLength: unmatchedReferences?.length,
          availableFilePathsType: typeof availableFilePaths,
          availableFilePathsLength: availableFilePaths?.length,
          usedPathsSetType: typeof usedPathsSet,
          usedPathsSetSize: usedPathsSet?.size
        });
        
        let result;
        try {
          console.log('🤖 Worker: Calling generateAutoMatchSuggestions NOW...');
          result = generateAutoMatchSuggestions(
            unmatchedReferences,
            availableFilePaths,
            usedPathsSet
          );
          console.log('🤖 Worker: generateAutoMatchSuggestions returned successfully');
          console.log('🤖 Worker: Result type:', typeof result);
          console.log('🤖 Worker: Result keys:', result ? Object.keys(result) : null);
        } catch (functionError) {
          console.error('🤖 Worker: CRITICAL - generateAutoMatchSuggestions threw error:', functionError);
          console.error('🤖 Worker: Function error stack:', functionError.stack);
          
          // Create emergency fallback
          result = {
            suggestions: [],
            totalReferences: unmatchedReferences?.length || 0,
            suggestionsWithHighConfidence: 0,
            suggestionsWithMediumConfidence: 0,
            suggestionsWithLowConfidence: 0
          };
          console.log('🤖 Worker: Created emergency fallback result');
        }
        
        console.log('🤖 Worker: generateAutoMatchSuggestions completed, preparing to send result');
        console.log('🤖 Worker: Result preview before sending:', {
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : null,
          suggestionsType: typeof result?.suggestions,
          suggestionsIsArray: Array.isArray(result?.suggestions),
          suggestionsLength: result?.suggestions?.length,
          totalReferences: result?.totalReferences,
          fullResult: result
        });
        
        // Final validation before sending
        if (!result || typeof result !== 'object') {
          console.error('🤖 Worker: CRITICAL - About to send invalid result!');
          throw new Error('Invalid result object before sending');
        }
        
        if (!Array.isArray(result.suggestions)) {
          console.error('🤖 Worker: CRITICAL - About to send result with invalid suggestions!');
          console.error('🤖 Worker: suggestions type:', typeof result.suggestions);
          console.error('🤖 Worker: suggestions value:', result.suggestions);
          throw new Error('Invalid suggestions array before sending');
        }
        
        const messageToSend = {
          type: 'AUTO_MATCH_COMPLETE',
          id,
          data: result
        };
        
        console.log('🤖 Worker: Message to send:', {
          messageType: messageToSend.type,
          messageId: messageToSend.id,
          dataType: typeof messageToSend.data,
          dataKeys: messageToSend.data ? Object.keys(messageToSend.data) : null,
          dataSuggestionsType: typeof messageToSend.data?.suggestions,
          dataSuggestionsIsArray: Array.isArray(messageToSend.data?.suggestions),
          dataSuggestionsLength: messageToSend.data?.suggestions?.length
        });
        
        try {
          self.postMessage(messageToSend);
          console.log('🤖 Worker: AUTO_MATCH_COMPLETE message sent successfully');
        } catch (sendError) {
          console.error('🤖 Worker: CRITICAL - Failed to send message:', sendError);
          throw sendError;
        }
        break;
        
      default:
        console.error(`🤖 Worker: Unknown message type: ${type}`);
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('🤖 Worker: CRITICAL ERROR in message handler:', error);
    console.error('🤖 Worker: Message handler error stack:', error.stack);
    console.error('🤖 Worker: Error occurred in message type:', type);
    console.error('🤖 Worker: Error occurred with message id:', id);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const errorResponse = {
      type: 'ERROR',
      id,
      error: errorMessage
    };
    
    console.log('🤖 Worker: Sending error response:', errorResponse);
    
    self.postMessage(errorResponse);
  }
};

// Global error handling
self.onerror = function(error) {
  console.error('🤖 Worker: Global error:', {
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
  console.error('🤖 Worker: Unhandled promise rejection:', event.reason);
  
  self.postMessage({
    type: 'WORKER_ERROR',
    error: {
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack
    }
  });
});

console.log('🤖 Auto-match worker fully initialized and ready');