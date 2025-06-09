// lib/types.ts - Type Definitions

export interface FileMatch {
  path: string;
  score: number;
}

export interface MatchedPair {
  reference: string;
  path: string;
  score: number;
  timestamp: string;
  method: 'manual' | 'auto' | 'manual-bulk';
  sessionId?: string;
}

export interface SearchResult extends FileMatch {
  isLearned?: boolean;
  scoreBreakdown?: {
    base: number;
    pattern: number;
    term: number;
    learned: number;
    final: number;
  };
}

export interface MatcherState {
  fileReferences: string[];
  filePaths: string[];
  unmatchedReferences: string[];
  matchedPairs: MatchedPair[];
  usedFilePaths: Set<string>;
  selectedReferences: Array<{ item: string; order: number }>;
  selectedFilePaths: Array<{ item: string; order: number }>;
  currentReference: string | null;
  selectedResult: FileMatch | null;
  sessionId: string;
  originalReferencesCount: number;
}

export interface MatcherActions {
  selectReference: (reference: string) => void;
  toggleReferenceSelection: (reference: string) => void;
  toggleFilePathSelection: (path: string) => void;
  selectAllReferences: () => void;
  confirmMatch: () => void;
  confirmBulkMatch: () => void;
  skipReference: () => void;
  removeMatch: (index: number) => void;
  bulkSkipReferences: () => void;
  bulkDeselectAll: () => void;
  detectRemainingFiles: () => void;
}