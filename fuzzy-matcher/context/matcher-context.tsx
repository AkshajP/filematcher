'use client';

// context/matcher-context.tsx - State Management Context

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { MatcherState, MatcherActions, MatchedPair, FileMatch } from '@/lib/types';

interface MatcherContextType extends MatcherState, MatcherActions {
  updateFilePathsOnly: (filePaths: string[]) => void;
}

const MatcherContext = createContext<MatcherContextType | undefined>(undefined);

type MatcherAction =
  | { type: 'INITIALIZE_DATA'; payload: { fileReferences: string[]; filePaths: string[] } }
  | { type: 'SELECT_REFERENCE'; payload: string }
  | { type: 'TOGGLE_REFERENCE_SELECTION'; payload: string }
  | { type: 'TOGGLE_FILEPATH_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_REFERENCES' }
  | { type: 'SET_SELECTED_RESULT'; payload: FileMatch | null }
  | { type: 'CONFIRM_MATCH' }
  | { type: 'CONFIRM_BULK_MATCH' }
  | { type: 'SKIP_REFERENCE' }
  | { type: 'REMOVE_MATCH'; payload: number }
  | { type: 'BULK_SKIP_REFERENCES' }
  | { type: 'BULK_DESELECT_ALL' }
  | { type: 'DETECT_REMAINING_FILES' }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'UPDATE_FILE_PATHS_ONLY'; payload: string[] };

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateReferencesFromPaths(filePaths: string[], usedFilePaths: Set<string>): string[] {
  const availableFilePaths = filePaths.filter(path => !usedFilePaths.has(path));
  
  return availableFilePaths.map(filePath => {
    const parts = filePath.split('/');
    const fileName = parts.pop() || '';
    let referenceName = fileName.replace(/\.[^/.]+$/, '');
    
    referenceName = referenceName
      .replace(/^\w+-/, '')
      .replace(/^RDCC-APPENDIX-\d+-\d+\s*-\s*/, '')
      .replace(/^(ELM-WAH-LTR-\d+|C0+\d+|D0+\d+|B0+\d+)\s*-?\s*/i, '')
      .replace(/dated\s+\d+\s+\w+\s+\d+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
      
    const parentFolder = parts[parts.length - 1];
    if (parts.length > 2 && parentFolder && !referenceName.toLowerCase().includes(parentFolder.toLowerCase())) {
      referenceName = `${parentFolder} - ${referenceName}`;
    }
    
    return referenceName || fileName;
  });
}

const initialState: MatcherState = {
  fileReferences: [],
  filePaths: [],
  unmatchedReferences: [],
  matchedPairs: [],
  usedFilePaths: new Set(),
  selectedReferences: [],
  selectedFilePaths: [],
  currentReference: null,
  selectedResult: null,
  sessionId: generateSessionId(),
  originalReferencesCount: 0,
};

function matcherReducer(state: MatcherState, action: MatcherAction): MatcherState {
  switch (action.type) {
    case 'INITIALIZE_DATA':
      return {
        ...state,
        fileReferences: action.payload.fileReferences,
        filePaths: action.payload.filePaths,
        unmatchedReferences: [...action.payload.fileReferences],
        originalReferencesCount: action.payload.fileReferences.length,
      };

    case 'UPDATE_FILE_PATHS_ONLY':
      return {
        ...state,
        filePaths: action.payload,
        // Don't change file references, just update paths
        // Clear used paths that no longer exist
        usedFilePaths: new Set([...state.usedFilePaths].filter(path => action.payload.includes(path))),
      };

    case 'SELECT_REFERENCE':
      return {
        ...state,
        currentReference: action.payload,
        selectedReferences: [],
        selectedFilePaths: [],
        selectedResult: null,
      };

    case 'TOGGLE_REFERENCE_SELECTION': {
      const existing = state.selectedReferences.find(item => item.item === action.payload);
      let newSelected;
      
      if (existing) {
        // Remove item but keep order numbers intact
        newSelected = state.selectedReferences.filter(item => item.item !== action.payload);
      } else {
        // Find the lowest available order number (fill gaps first)
        const usedOrders = new Set(state.selectedReferences.map(item => item.order));
        let nextOrder = 1;
        
        // Find the first available order number
        while (usedOrders.has(nextOrder)) {
          nextOrder++;
        }
        
        newSelected = [...state.selectedReferences, { item: action.payload, order: nextOrder }];
      }
      
      const selectedResult = newSelected.length > 0 ? null : state.selectedResult;
      
      return {
        ...state,
        selectedReferences: newSelected,
        selectedResult,
      };
    }

    case 'TOGGLE_FILEPATH_SELECTION': {
      const existing = state.selectedFilePaths.find(item => item.item === action.payload);
      let newSelected;
      
      if (existing) {
        // Remove item but keep order numbers intact
        newSelected = state.selectedFilePaths.filter(item => item.item !== action.payload);
      } else {
        // Only allow selection if we haven't exceeded reference count
        if (state.selectedFilePaths.length < state.selectedReferences.length) {
          // Find the lowest available order number (fill gaps first)
          const usedOrders = new Set(state.selectedFilePaths.map(item => item.order));
          let nextOrder = 1;
          
          // Find the first available order number
          while (usedOrders.has(nextOrder) && nextOrder <= state.selectedReferences.length) {
            nextOrder++;
          }
          
          newSelected = [...state.selectedFilePaths, { item: action.payload, order: nextOrder }];
        } else {
          return state; // Don't allow selection
        }
      }
      return {
        ...state,
        selectedFilePaths: newSelected,
        selectedResult: null,
      };
    }

    case 'SELECT_ALL_REFERENCES': {
      const allSelected = state.selectedReferences.length === state.unmatchedReferences.length;
      let newSelected: Array<{ item: string; order: number }> = [];
      
      if (!allSelected) {
        newSelected = state.unmatchedReferences.map((ref, index) => ({
          item: ref,
          order: index + 1
        }));
      }
      
      return {
        ...state,
        selectedReferences: newSelected,
        selectedFilePaths: [],
        selectedResult: null,
      };
    }

    case 'SET_SELECTED_RESULT':
      return {
        ...state,
        selectedResult: action.payload,
        selectedFilePaths: [], // Clear bulk selections
      };

    case 'CONFIRM_MATCH': {
      if (!state.currentReference || !state.selectedResult) return state;
      
      const newPair: MatchedPair = {
        reference: state.currentReference,
        path: state.selectedResult.path,
        score: state.selectedResult.score,
        timestamp: new Date().toISOString(),
        method: 'manual',
        sessionId: state.sessionId,
      };
      
      const newUsedPaths = new Set(state.usedFilePaths);
      newUsedPaths.add(state.selectedResult.path);
      
      const newUnmatched = state.unmatchedReferences.filter(ref => ref !== state.currentReference);
      const nextReference = newUnmatched.length > 0 ? newUnmatched[0] : null;
      
      return {
        ...state,
        matchedPairs: [...state.matchedPairs, newPair],
        usedFilePaths: newUsedPaths,
        unmatchedReferences: newUnmatched,
        currentReference: nextReference,
        selectedResult: null,
      };
    }

    case 'CONFIRM_BULK_MATCH': {
      // Sort by order number before extracting items to ensure correct pairing
      const refsArray = state.selectedReferences
        .sort((a, b) => a.order - b.order)
        .map(item => item.item);
      const pathsArray = state.selectedFilePaths
        .sort((a, b) => a.order - b.order)
        .map(item => item.item);
      
      if (refsArray.length !== pathsArray.length || refsArray.length < 2) {
        return state;
      }
      
      const newPairs: MatchedPair[] = refsArray.map((ref, index) => ({
        reference: ref,
        path: pathsArray[index], // Now correctly maps by visual order
        score: 1.0,
        timestamp: new Date().toISOString(),
        method: 'manual-bulk' as const,
        sessionId: state.sessionId,
      }));
      
      const newUsedPaths = new Set(state.usedFilePaths);
      pathsArray.forEach(path => newUsedPaths.add(path));
      
      const newUnmatched = state.unmatchedReferences.filter(ref => !refsArray.includes(ref));
      const nextReference = newUnmatched.length > 0 ? newUnmatched[0] : null;
      
      return {
        ...state,
        matchedPairs: [...state.matchedPairs, ...newPairs],
        usedFilePaths: newUsedPaths,
        unmatchedReferences: newUnmatched,
        selectedReferences: [],
        selectedFilePaths: [],
        currentReference: nextReference,
      };
    }

    case 'SKIP_REFERENCE': {
      if (!state.currentReference) return state;
      
      const index = state.unmatchedReferences.indexOf(state.currentReference);
      if (index === -1) return state;
      
      const newUnmatched = [...state.unmatchedReferences];
      newUnmatched.splice(index, 1);
      newUnmatched.push(state.currentReference);
      
      const nextReference = newUnmatched.length > 0 ? newUnmatched[0] : null;
      
      return {
        ...state,
        unmatchedReferences: newUnmatched,
        currentReference: nextReference,
        selectedResult: null,
      };
    }

    case 'REMOVE_MATCH': {
      const pair = state.matchedPairs[action.payload];
      if (!pair) return state;
      
      const newUsedPaths = new Set(state.usedFilePaths);
      newUsedPaths.delete(pair.path);
      
      const newPairs = state.matchedPairs.filter((_, index) => index !== action.payload);
      const newUnmatched = [pair.reference, ...state.unmatchedReferences];
      
      return {
        ...state,
        matchedPairs: newPairs,
        usedFilePaths: newUsedPaths,
        unmatchedReferences: newUnmatched,
      };
    }

    case 'BULK_SKIP_REFERENCES': {
      const selected = state.selectedReferences.map(item => item.item);
      const newUnmatched = [...state.unmatchedReferences];
      
      // Move selected references to end
      selected.forEach(ref => {
        const index = newUnmatched.indexOf(ref);
        if (index > -1) {
          newUnmatched.splice(index, 1);
          newUnmatched.push(ref);
        }
      });
      
      const nextReference = newUnmatched.length > 0 ? newUnmatched[0] : null;
      
      return {
        ...state,
        unmatchedReferences: newUnmatched,
        selectedReferences: [],
        selectedFilePaths: [],
        currentReference: nextReference,
      };
    }

    case 'BULK_DESELECT_ALL':
      return {
        ...state,
        selectedReferences: [],
        selectedFilePaths: [],
      };

    case 'DETECT_REMAINING_FILES': {
      const newReferences = generateReferencesFromPaths(state.filePaths, state.usedFilePaths);
      const uniqueNew = newReferences.filter(ref => !state.unmatchedReferences.includes(ref));
      
      return {
        ...state,
        unmatchedReferences: [...state.unmatchedReferences, ...uniqueNew],
      };
    }

    case 'CLEAR_SELECTIONS':
      return {
        ...state,
        selectedReferences: [],
        selectedFilePaths: [],
        selectedResult: null,
      };

    default:
      return state;
  }
}

export function MatcherProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(matcherReducer, initialState);

  const actions: MatcherActions = {
    selectReference: useCallback((reference: string) => {
      dispatch({ type: 'SELECT_REFERENCE', payload: reference });
    }, []),

    toggleReferenceSelection: useCallback((reference: string) => {
      dispatch({ type: 'TOGGLE_REFERENCE_SELECTION', payload: reference });
    }, []),

    toggleFilePathSelection: useCallback((path: string) => {
      dispatch({ type: 'TOGGLE_FILEPATH_SELECTION', payload: path });
    }, []),

    selectAllReferences: useCallback(() => {
      dispatch({ type: 'SELECT_ALL_REFERENCES' });
    }, []),

    confirmMatch: useCallback(() => {
      dispatch({ type: 'CONFIRM_MATCH' });
    }, []),

    confirmBulkMatch: useCallback(() => {
      dispatch({ type: 'CONFIRM_BULK_MATCH' });
    }, []),

    skipReference: useCallback(() => {
      dispatch({ type: 'SKIP_REFERENCE' });
    }, []),

    removeMatch: useCallback((index: number) => {
      dispatch({ type: 'REMOVE_MATCH', payload: index });
    }, []),

    bulkSkipReferences: useCallback(() => {
      dispatch({ type: 'BULK_SKIP_REFERENCES' });
    }, []),

    bulkDeselectAll: useCallback(() => {
      dispatch({ type: 'BULK_DESELECT_ALL' });
    }, []),

    detectRemainingFiles: useCallback(() => {
      dispatch({ type: 'DETECT_REMAINING_FILES' });
    }, []),

    updateFilePathsOnly: useCallback((filePaths: string[]) => {
      dispatch({ type: 'UPDATE_FILE_PATHS_ONLY', payload: filePaths });
    }, []),
  };

  // Initialize data method
  const initializeData = useCallback((fileReferences: string[], filePaths: string[]) => {
    dispatch({ type: 'INITIALIZE_DATA', payload: { fileReferences, filePaths } });
  }, []);

  const setSelectedResult = useCallback((result: FileMatch | null) => {
    dispatch({ type: 'SET_SELECTED_RESULT', payload: result });
  }, []);

  const contextValue: MatcherContextType = {
    ...state,
    ...actions,
    // @ts-ignore - hidden dispatch for initialization
    __dispatch: dispatch,
  };

  return (
    <MatcherContext.Provider value={contextValue}>
      {children}
    </MatcherContext.Provider>
  );
}

// Create extended context type with initialization
interface MatcherContextWithInit extends MatcherContextType {
  initializeData: (fileReferences: string[], filePaths: string[]) => void;
  setSelectedResult: (result: FileMatch | null) => void;
}

export function useMatcher(): MatcherContextWithInit {
  const context = useContext(MatcherContext);
  if (context === undefined) {
    throw new Error('useMatcher must be used within a MatcherProvider');
  }
  
  const initializeData = useCallback((fileReferences: string[], filePaths: string[]) => {
    // @ts-ignore - we need this for initialization
    context.__dispatch?.({ type: 'INITIALIZE_DATA', payload: { fileReferences, filePaths } });
  }, [context]);

  const setSelectedResult = useCallback((result: FileMatch | null) => {
    // @ts-ignore - we need this for result selection
    context.__dispatch?.({ type: 'SET_SELECTED_RESULT', payload: result });
  }, [context]);

  return {
    ...context,
    initializeData,
    setSelectedResult,
  };
}