'use client';

// context/matcher-context.tsx - State Management Context

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { MatcherState, MatcherActions, MatchedPair, FileMatch, FileReference } from '@/lib/types';

interface MatcherContextType extends MatcherState, MatcherActions {
  updateFilePathsOnly: (filePaths: string[]) => void;
}

const MatcherContext = createContext<MatcherContextType | undefined>(undefined);

type MatcherAction =
  | { type: 'INITIALIZE_DATA'; payload: { fileReferences: FileReference[]; filePaths: string[] } }
  | { type: 'SELECT_REFERENCE'; payload: FileReference }
  | { type: 'TOGGLE_REFERENCE_SELECTION'; payload: FileReference }
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
  | { type: 'IMPORT_MAPPINGS' }
  | { type: 'UPDATE_FILE_PATHS_ONLY'; payload: string[] };

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateReferencesFromPaths(filePaths: string[], usedFilePaths: Set<string>): FileReference[] {
  const availableFilePaths = filePaths.filter(path => !usedFilePaths.has(path));
  
  return availableFilePaths.map(filePath => {
    const parts = filePath.split('/');
    const fileName = parts.pop() || '';
    let description = fileName.replace(/\.[^/.]+$/, '');
    
    description = description
      .replace(/^\w+-/, '')
      .replace(/^RDCC-APPENDIX-\d+-\d+\s*-\s*/, '')
      .replace(/^(ELM-WAH-LTR-\d+|C0+\d+|D0+\d+|B0+\d+)\s*-?\s*/i, '')
      .replace(/dated\s+\d+\s+\w+\s+\d+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
      
    const parentFolder = parts[parts.length - 1];
    if (parts.length > 2 && parentFolder && !description.toLowerCase().includes(parentFolder.toLowerCase())) {
      description = `${parentFolder} - ${description}`;
    }
    
    return {
      description: description || fileName,
      isGenerated: true
    };
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
  folderName: '',
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
      const existing = state.selectedReferences.find(item => item.item.description === action.payload.description);
      let newSelected;
      
      if (existing) {
        newSelected = state.selectedReferences.filter(item => item.item.description !== action.payload.description);
      } else {
        const usedOrders = new Set(state.selectedReferences.map(item => item.order));
        let nextOrder = 1;
        
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
    reference: state.currentReference.description,
    path: state.selectedResult.path,
    score: state.selectedResult.score,
    timestamp: new Date().toISOString(),
    method: 'manual',
    sessionId: state.sessionId,
    originalDate: state.currentReference.date,
    originalReference: state.currentReference.reference,
  };
  
  const newUsedPaths = new Set(state.usedFilePaths);
  newUsedPaths.add(state.selectedResult.path);
  
  const newUnmatched = state.unmatchedReferences.filter(ref => ref.description !== state.currentReference?.description);
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
    .sort((a, b) => a.order - b.order);
  const pathsArray = state.selectedFilePaths
    .sort((a, b) => a.order - b.order)
    .map(item => item.item);
  
  if (refsArray.length !== pathsArray.length || refsArray.length < 2) {
    return state;
  }
  
  const newPairs: MatchedPair[] = refsArray.map((refItem, index) => ({
    reference: refItem.item.description,
    path: pathsArray[index],
    score: 1.0,
    timestamp: new Date().toISOString(),
    method: 'manual-bulk' as const,
    sessionId: state.sessionId,
    originalDate: refItem.item.date,
    originalReference: refItem.item.reference,
  }));
  
  const newUsedPaths = new Set(state.usedFilePaths);
  pathsArray.forEach(path => newUsedPaths.add(path));
  
  const refDescriptions = refsArray.map(ref => ref.item.description);
  const newUnmatched = state.unmatchedReferences.filter(ref => !refDescriptions.includes(ref.description));
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
  
  const index = state.unmatchedReferences.findIndex(ref => ref.description === state.currentReference?.description);
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
  
  // Recreate the reference object from the pair
  const restoredReference: FileReference = {
    description: pair.reference,
    date: pair.originalDate,
    reference: pair.originalReference,
    isGenerated: false
  };
  
  const newUnmatched = [restoredReference, ...state.unmatchedReferences];
  
  return {
    ...state,
    matchedPairs: newPairs,
    usedFilePaths: newUsedPaths,
    unmatchedReferences: newUnmatched,
  };
}

    case 'BULK_SKIP_REFERENCES': {
  const selectedDescriptions = state.selectedReferences.map(item => item.item.description);
  const newUnmatched = [...state.unmatchedReferences];
  
  // Move selected references to end
  selectedDescriptions.forEach(desc => {
    const index = newUnmatched.findIndex(ref => ref.description === desc);
    if (index > -1) {
      const ref = newUnmatched.splice(index, 1)[0];
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

      case 'IMPORT_MAPPINGS': {
          const { mappings, newReferences, usedPaths, folderName } = action.payload;
          
          // Add new references to existing ones (these could be restored missing refs)
          const allReferences = [...state.fileReferences, ...newReferences];
          
          // Find which references are not yet matched
          const mappedReferences = new Set(mappings.map(m => m.reference));
          const newUnmatched = allReferences.filter(ref => !mappedReferences.has(ref.description));
          
          // Set next reference if none currently selected
          const nextReference = newUnmatched.length > 0 ? newUnmatched[0] : null;
          
          return {
            ...state,
            fileReferences: allReferences,
            unmatchedReferences: newUnmatched,
            matchedPairs: [...state.matchedPairs, ...mappings],
            usedFilePaths: new Set([...state.usedFilePaths, ...usedPaths]),
            currentReference: state.currentReference || nextReference,
            originalReferencesCount: allReferences.length,
            folderName: folderName || state.folderName,
            selectedReferences: [],
            selectedFilePaths: [],
            selectedResult: null,
          };
        }

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

    importMappings: useCallback((mappings: MatchedPair[], newReferences: FileReference[], usedPaths: Set<string>, folderName?: string) => {
      dispatch({ type: 'IMPORT_MAPPINGS', payload: { mappings, newReferences, usedPaths, folderName } });
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

interface MatcherContextWithInit extends MatcherContextType {
  initializeData: (fileReferences: FileReference[], filePaths: string[], folderName?: string) => void;
  setSelectedResult: (result: FileMatch | null) => void;
  importMappings: (mappings: MatchedPair[], newReferences: FileReference[], usedPaths: Set<string>, folderName?: string) => void;
}

export function useMatcher(): MatcherContextWithInit {
  const context = useContext(MatcherContext);
  if (context === undefined) {
    throw new Error('useMatcher must be used within a MatcherProvider');
  }
  
  const initializeData = useCallback((fileReferences: FileReference[], filePaths: string[], folderName?: string) => {
    // @ts-ignore - we need this for initialization
    context.__dispatch?.({ type: 'INITIALIZE_DATA', payload: { fileReferences, filePaths, folderName } });
  }, [context]);

  const setSelectedResult = useCallback((result: FileMatch | null) => {
    // @ts-ignore - we need this for result selection
    context.__dispatch?.({ type: 'SET_SELECTED_RESULT', payload: result });
  }, [context]);

  return {
    ...context,
    initializeData,
    setSelectedResult,
    importMappings: context.importMappings, // Explicitly include this
  };
}