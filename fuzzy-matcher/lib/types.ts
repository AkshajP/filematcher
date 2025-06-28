// fuzzy-matcher/lib/types.ts - Enhanced ID generation

export interface FileMatch {
  path: string;
  score: number;
}

export interface FileReference {
  id: string; // Unique identifier
  description: string;
  date?: string;
  reference?: string;
  isGenerated?: boolean; // To distinguish auto-generated vs imported
}

export interface MatchedPair {
  id: string; // Unique identifier for the pair
  referenceId: string; // References the FileReference.id - crucial for proper deletion
  reference: string; // Human-readable reference description
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
  folderName: string;
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

// Enhanced ID generation with better uniqueness and collision detection
export const generateUniqueId = (): string => {
  // Use timestamp + random for better uniqueness
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 9);
  const extraRandom = Math.random().toString(36).substr(2, 4);
  
  return `${timestamp}_${randomPart}_${extraRandom}`;
};

// Utility function to ensure references have proper IDs
export const ensureReferenceIds = (references: FileReference[]): FileReference[] => {
  return references.map(ref => ({
    ...ref,
    id: ref.id || generateUniqueId()
  }));
};

// Utility function to validate a MatchedPair has required fields
export const validateMatchedPair = (pair: MatchedPair): boolean => {
  const requiredFields = ['id', 'referenceId', 'reference', 'path'];
  return requiredFields.every(field => pair[field as keyof MatchedPair]);
};

// Debug function to check for ID conflicts
export const findIdConflicts = (items: { id: string }[]): string[] => {
  const seen = new Set<string>();
  const conflicts: string[] = [];
  
  items.forEach(item => {
    if (seen.has(item.id)) {
      conflicts.push(item.id);
    } else {
      seen.add(item.id);
    }
  });
  
  return conflicts;
};