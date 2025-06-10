// hooks/use-matcher.ts - Main Matcher Hook

import { useState, useEffect, useMemo, useCallback } from "react";
import { searchMatches } from "@/lib/fuzzy-matcher";
import { loadDataSources, createDataFromFolder } from "@/lib/data-loader";
import { SearchResult } from "@/lib/types";
import { useMatcher } from "@/context/matcher-context";

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
  if (matcher.fileReferences.length === 0) {
    setIsLoading(false);
  }
}, [matcher.fileReferences.length]);

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

  // Perform search when search term or current reference changes
  useEffect(() => {
    if (!matcher.currentReference && !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    // Use debouncing for better performance
    const timeoutId = setTimeout(() => {
      const term = searchTerm || matcher.currentReference || "";
      const results = searchMatches(
        term,
        matcher.filePaths,
        matcher.usedFilePaths
      );
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    searchTerm,
    matcher.currentReference,
    matcher.filePaths,
    matcher.usedFilePaths,
  ]);

  // Auto-select first reference when available
  useEffect(() => {
    if (!matcher.currentReference && matcher.unmatchedReferences.length > 0) {
      matcher.selectReference(matcher.unmatchedReferences[0]);
    }
  }, [
    matcher.unmatchedReferences.length,
    matcher.currentReference,
    matcher.selectReference,
  ]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = matcher.fileReferences.length;
    const matched = matcher.matchedPairs.length;
    const unmatched = matcher.unmatchedReferences.length;
    const progress = total > 0 ? Math.round((matched / total) * 100) : 0;

    return { total, matched, unmatched, progress };
  }, [
    matcher.fileReferences.length,
    matcher.matchedPairs.length,
    matcher.unmatchedReferences.length,
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
      ["File Reference", "File Path", "Match Score", "Timestamp", "Method"],
      ...matcher.matchedPairs.map((pair) => [
        pair.reference,
        pair.path,
        `${(pair.score * 100).toFixed(1)}%`,
        pair.timestamp,
        pair.method,
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
    stats,
    bulkValidation,

    // Actions
    handleResultSelect,
    exportMappings,
    loadFallbackData,
  };
}
