'use client';

// context/matcher-context.tsx - State Management Context

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { MatcherState, MatcherActions, MatchedPair, FileMatch } from '@/lib/types';

interface MatcherContextType extends MatcherState, MatcherActions {}

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
  | { type: 'CLEAR_SELECTIONS' };

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
  selectedReferences: new Set(),
  selectedFilePaths: new Set(),
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

    case 'SELECT_REFERENCE':
      return {
        ...state,
        currentReference: action.payload,
        selectedReferences: new Set(),
        selectedFilePaths: new Set(),
        selectedResult: null,
      };

    case 'TOGGLE_REFERENCE_SELECTION': {
      const newSelected = new Set(state.selectedReferences);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      
      // Clear single selection when entering bulk mode
      const selectedResult = newSelected.size > 0 ? null : state.selectedResult;
      
      return {
        ...state,
        selectedReferences: newSelected,
        selectedResult,
      };
    }

    case 'TOGGLE_FILEPATH_SELECTION': {
      const newSelected = new Set(state.selectedFilePaths);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        // Only allow selection if we haven't exceeded reference count
        if (newSelected.size < state.selectedReferences.size) {
          newSelected.add(action.payload);
        }
      }
      
      return {
        ...state,
        selectedFilePaths: newSelected,
        selectedResult: null, // Clear single selection when using bulk
      };
    }

    case 'SELECT_ALL_REFERENCES': {
      const allSelected = state.selectedReferences.size === state.unmatchedReferences.length;
      return {
        ...state,
        selectedReferences: allSelected ? new Set() : new Set(state.unmatchedReferences),
        selectedFilePaths: new Set(),
        selectedResult: null,
      };
    }

    case 'SET_SELECTED_RESULT':
      return {
        ...state,
        selectedResult: action.payload,
        selectedFilePaths: new Set(), // Clear bulk selections
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
      const refsArray = Array.from(state.selectedReferences);
      const pathsArray = Array.from(state.selectedFilePaths);
      
      if (refsArray.length !== pathsArray.length || refsArray.length < 2) {
        return state;
      }
      
      const newPairs: MatchedPair[] = refsArray.map((ref, index) => ({
        reference: ref,
        path: pathsArray[index],
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
        selectedReferences: new Set(),
        selectedFilePaths: new Set(),
        currentReference: nextReference,
        selectedResult: null,
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
      const selected = Array.from(state.selectedReferences);
      let newUnmatched = [...state.unmatchedReferences];
      
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
        selectedReferences: new Set(),
        selectedFilePaths: new Set(),
        currentReference: nextReference,
      };
    }

    case 'BULK_DESELECT_ALL':
      return {
        ...state,
        selectedReferences: new Set(),
        selectedFilePaths: new Set(),
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
        selectedReferences: new Set(),
        selectedFilePaths: new Set(),
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
      {/* Hidden methods for components */}
      <div style={{ display: 'none' }}>
        {/* These are passed via props to components that need them */}
      </div>
    </MatcherContext.Provider>
  );
}

// export function useMatcher() {
//   const context = useContext(MatcherContext);
//   if (context === undefined) {
//     throw new Error('useMatcher must be used within a MatcherProvider');
//   }
//   return context;
// }

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