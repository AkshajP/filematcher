// hooks/use-matcher.ts - Main Matcher Hook with Worker Support

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getWorkerManager } from "@/workers/worker-manager";
import { loadDataSources, createDataFromFolder } from "@/lib/data-loader";
import { SearchResult } from "@/lib/types";
import { useMatcher } from "@/context/matcher-context";
import { exportMappingsWithMetadata, extractFolderName } from "@/lib/export-manager";

export function useMatcherLogic() {
  const matcher = useMatcher();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessingFolder, setIsProcessingFolder] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  
  // Worker manager reference
  const workerManagerRef = useRef(getWorkerManager());
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Only set loading to false, don't auto-load data
    // Data should only be loaded via explicit import actions
    setIsLoading(false);
  }, []);

  // Initialize worker when file paths change
  useEffect(() => {
    const initializeWorker = async () => {
      const filePaths = matcher.filePaths || [];
      if (filePaths.length > 0) {
        try {
          setIsLoading(true);
          await workerManagerRef.current.initializeSearch(filePaths);
          setIsWorkerReady(true);
          console.log(`Worker initialized with ${filePaths.length} file paths`);
        } catch (error) {
          console.warn('Worker initialization failed, using fallback:', error);
          setIsWorkerReady(false);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsWorkerReady(false);
      }
    };

    initializeWorker();
  }, [matcher.filePaths]);

  // Add this new function for explicit data loading
  const loadFallbackData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await loadDataSources();
      matcher.initializeData(data.fileReferences, data.filePaths);
    } catch (error) {
      console.error("Failed to load fallback data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [matcher]);

  // Debounced search function using worker
  const performSearch = useCallback(async (term: string, usedPaths: Set<string>) => {
    const filePaths = matcher.filePaths || [];
    
    if (filePaths.length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const trimmedTerm = term.trim();

    // If no current reference and no meaningful search term, show all available files
    if (!matcher.currentReference && !trimmedTerm) {
      const allFiles = filePaths
        .filter(path => !usedPaths.has(path))
        .map(path => ({ path, score: 0 }));
      setSearchResults(allFiles);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      
      // Use trimmed search term or current reference description
      const searchQuery = trimmedTerm || matcher.currentReference?.description || "";
      
      const results = await workerManagerRef.current.search(searchQuery, usedPaths);
      setSearchResults(results);
      
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [matcher.currentReference?.description, matcher.filePaths]);

  // Perform search when search term, current reference, or paths change
  useEffect(() => {
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const usedFilePaths = matcher.usedFilePaths || new Set();
    
    // Debounce search for better performance
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchTerm, usedFilePaths);
    }, 150); // 150ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [
    searchTerm,
    matcher.currentReference?.description,
    matcher.filePaths,
    matcher.usedFilePaths,
    performSearch,
  ]);

  // Auto-select first reference when available (only if we have references)
  useEffect(() => {
    if (!matcher.currentReference && 
        matcher.unmatchedReferences.length > 0 && 
        matcher.fileReferences.length > 0) {
      matcher.selectReference(matcher.unmatchedReferences[0]);
    }
  }, [
    matcher.unmatchedReferences.length,
    matcher.currentReference,
    matcher.fileReferences.length,
    matcher.selectReference,
  ]);

  // Calculate statistics
  const stats = useMemo(() => {
    const fileReferences = matcher.fileReferences || [];
    const matchedPairs = matcher.matchedPairs || [];
    const unmatchedReferences = matcher.unmatchedReferences || [];
    
    const total = fileReferences.length;
    const matched = matchedPairs.length;
    const unmatched = unmatchedReferences.length;
    const progress = total > 0 ? Math.round((matched / total) * 100) : 0;

    return { total, matched, unmatched, progress };
  }, [
    matcher.fileReferences,
    matcher.matchedPairs,
    matcher.unmatchedReferences,
  ]);

  // Validation for bulk operations
  const bulkValidation = useMemo(() => {
    const refCount = matcher.selectedReferences.length;
    const pathCount = matcher.selectedFilePaths.length;

    return {
      canBulkMatch: refCount >= 2 && pathCount === refCount,
      canSingleMatch: refCount === 0 && !!matcher.selectedResult,
      isInBulkMode: refCount > 0,
      selectionValid: pathCount <= refCount,
    };
  }, [
    matcher.selectedReferences.length,
    matcher.selectedFilePaths.length,
    matcher.selectedResult,
  ]);

  // Handle search result selection
  const handleResultSelect = useCallback(
    (path: string, score: number) => {
      // Clear bulk selections when making single selection
      if (matcher.selectedReferences.length === 0) {
        matcher.setSelectedResult({ path, score });
      }
    },
    [matcher.selectedReferences.length, matcher.setSelectedResult]
  );

  // Export mappings (enhanced version with metadata)
  const exportMappings = useCallback(() => {
    const folderName = extractFolderName(matcher.filePaths);
    const csvContent = exportMappingsWithMetadata(
      matcher.matchedPairs,
      matcher.filePaths,
      folderName,
      matcher.sessionId
    );

    // Create and download blob
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `file_mappings_${folderName}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    return csvContent;
  }, [matcher.matchedPairs, matcher.filePaths, matcher.sessionId]);

  // Worker-powered auto-match function
  const generateAutoMatch = useCallback(async (onProgress?: (data: any) => void) => {
    try {
      const result = await workerManagerRef.current.generateAutoMatch(
        matcher.unmatchedReferences,
        matcher.filePaths,
        matcher.usedFilePaths,
        onProgress
      );
      return result;
    } catch (error) {
      console.error('Auto-match generation failed:', error);
      throw error;
    }
  }, [matcher.unmatchedReferences, matcher.filePaths, matcher.usedFilePaths]);

  // Update search index when file paths change
  const updateSearchIndex = useCallback(async (newFilePaths: string[]) => {
    try {
      await workerManagerRef.current.updateSearchIndex(newFilePaths);
      setIsWorkerReady(true);
    } catch (error) {
      console.warn('Failed to update search index:', error);
      setIsWorkerReady(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    matcher,
    searchTerm,
    setSearchTerm,
    searchResults,
    isLoading,
    isSearching,
    isProcessingFolder,
    isWorkerReady,
    stats,
    bulkValidation,

    // Actions
    handleResultSelect,
    exportMappings,
    loadFallbackData,
    generateAutoMatch,
    updateSearchIndex,
    
    // Worker status
    workerStatus: workerManagerRef.current.getStatus(),
  };
}