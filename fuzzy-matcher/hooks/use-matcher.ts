// hooks/use-matcher.ts - Main Matcher Hook

import { useState, useEffect, useMemo, useCallback } from "react";
import { SearchIndex } from "@/lib/fuzzy-matcher";
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

  useEffect(() => {
    // Only set loading to false, don't auto-load data
    // Data should only be loaded via explicit import actions
    setIsLoading(false);
  }, []);

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

  // Create search index when file paths change
  const searchIndex = useMemo(() => {
    const filePaths = matcher.filePaths || [];
    if (filePaths.length > 0) {
      return new SearchIndex(filePaths);
    }
    return null;
  }, [matcher.filePaths]);

  // Perform search when search term, current reference, or search index changes
  useEffect(() => {
    const filePaths = matcher.filePaths || [];
    const usedFilePaths = matcher.usedFilePaths || new Set();
    
    // If no file paths are loaded, show empty results
    if (filePaths.length === 0 || !searchIndex) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Trim search term to handle trailing spaces
    const trimmedSearchTerm = searchTerm.trim();

    // If no current reference and no meaningful search term, show all available files
    if (!matcher.currentReference && !trimmedSearchTerm) {
      const allFiles = filePaths
        .filter(path => !usedFilePaths.has(path))
        .map(path => ({ path, score: 0 }));
      setSearchResults(allFiles);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Use trimmed search term or current reference description
    const term = trimmedSearchTerm || matcher.currentReference?.description || "";
    const results = searchIndex.search(term, usedFilePaths);
    setSearchResults(results);
    setIsSearching(false);
  }, [
    searchTerm,
    matcher.currentReference?.description,
    matcher.filePaths,
    matcher.usedFilePaths,
    searchIndex,
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

  return {
    // State
    matcher,
    searchTerm,
    setSearchTerm,
    searchResults,
    isLoading,
    isSearching,
    isProcessingFolder,
    stats,
    bulkValidation,

    // Actions
    handleResultSelect,
    exportMappings,
    loadFallbackData,
  };
}