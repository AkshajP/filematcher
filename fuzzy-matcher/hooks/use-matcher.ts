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

  // Perform search when search term, current reference, or file paths change

    useEffect(() => {
      // Safe guard against undefined
      const filePaths = matcher.filePaths || [];
      const usedFilePaths = matcher.usedFilePaths || new Set();
      
      // If no file paths are loaded, show empty results
      if (filePaths.length === 0) {
        setSearchResults([]);
        return;
      }

      // If no current reference and no search term, show all available files
      if (!matcher.currentReference && !searchTerm.trim()) {
        const allFiles = filePaths
          .filter(path => !usedFilePaths.has(path))
          .map(path => ({ path, score: 0 }));
        setSearchResults(allFiles);
        return;
      }

      setIsSearching(true);

      // Use debouncing for better performance
      const timeoutId = setTimeout(() => {
        const term = searchTerm || matcher.currentReference?.description || "";
        const results = SearchIndex(
          term,
          filePaths,
          usedFilePaths
        );
        setSearchResults(results);
        setIsSearching(false);
      }, 300);

      return () => {
        clearTimeout(timeoutId);
      };
    }, [
      searchTerm,
      matcher.currentReference?.description,
      matcher.filePaths,
      matcher.usedFilePaths,
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

  // Export mappings (simplified version)
  const exportMappings = useCallback(() => {
      const csvData = [
        ["File Reference", "File Path", "Match Score", "Timestamp", "Method", "Original Date", "Original Reference"],
        ...matcher.matchedPairs.map((pair) => [
          pair.reference,
          pair.path,
          `${(pair.score * 100).toFixed(1)}%`,
          pair.timestamp,
          pair.method,
          pair.originalDate || '',
          pair.originalReference || ''
        ]),
      ];

      const csvContent = csvData
        .map((row) =>
          row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

      // Create and download blob
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `file_mappings_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      return csvContent;
    }, [matcher.matchedPairs]);

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