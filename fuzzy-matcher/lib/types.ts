// lib/types.ts - Type Definitions

export interface FileMatch {
  path: string;
  score: number;
}

export interface FileReference {
  description: string;
  date?: string;
  reference?: string;
  isGenerated?: boolean; // To distinguish auto-generated vs imported
}

export interface MatchedPair {
  reference: string;
  path: string;
  score: number;
  timestamp: string;
  method: 'manual' | 'auto' | 'manual-bulk';
  sessionId?: string;
  // Add the additional reference data for export
  originalDate?: string;
  originalReference?: string;
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
  fileReferences: FileReference[];
  filePaths: string[];
  unmatchedReferences: FileReference[];
  matchedPairs: MatchedPair[];
  usedFilePaths: Set<string>;
  selectedReferences: Array<{ item: FileReference; order: number }>;
  selectedFilePaths: Array<{ item: string; order: number }>;
  currentReference: FileReference | null;
  selectedResult: FileMatch | null;
  sessionId: string;
  originalReferencesCount: number;
}

export interface MatcherActions {
  selectReference: (reference: FileReference) => void;
  toggleReferenceSelection: (reference: FileReference) => void;
  toggleFilePathSelection: (path: string) => void;
  selectAllReferences: () => void;
  confirmMatch: () => void;
  confirmBulkMatch: () => void;
  skipReference: () => void;
  removeMatch: (index: number) => void;
  bulkSkipReferences: () => void;
  bulkDeselectAll: () => void;
  detectRemainingFiles: () => void;
  updateFilePathsOnly: (filePaths: string[]) => void;
}