// components/auto-match-dialog.tsx - Auto Match Dialog Component

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { AutoMatchSuggestion, AutoMatchResult } from '@/lib/auto-matcher';
import { CheckCircle, XCircle, Zap, Filter, Check, X } from 'lucide-react';

interface AutoMatchDialogProps {
  autoMatchResult: AutoMatchResult;
  onAccept: (acceptedSuggestions: AutoMatchSuggestion[]) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function AutoMatchDialog({
  autoMatchResult,
  onAccept,
  onCancel,
  isProcessing = false
}: AutoMatchDialogProps) {
  const [suggestions, setSuggestions] = useState<AutoMatchSuggestion[]>(autoMatchResult.suggestions);
  const [minConfidence, setMinConfidence] = useState([40]); // Minimum confidence filter
  const [cursorIndex, setCursorIndex] = useState(0);
  const [rangeAnchor, setRangeAnchor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Filter suggestions based on confidence threshold
  const filteredSuggestions = suggestions.filter(s => 
    s.score >= (minConfidence[0] / 100) && s.suggestedPath !== ''
  );

  // Stats for current filtered view
  const selectedCount = filteredSuggestions.filter(s => s.isSelected).length;
  const acceptedCount = suggestions.filter(s => s.isAccepted).length;
  const rejectedCount = suggestions.filter(s => s.isRejected).length;
  const pendingCount = suggestions.length - acceptedCount - rejectedCount;

  // Update suggestions when original data changes
  useEffect(() => {
    setSuggestions(autoMatchResult.suggestions);
  }, [autoMatchResult]);

  // Reset cursor when filtered suggestions change
  useEffect(() => {
    if (cursorIndex >= filteredSuggestions.length) {
      setCursorIndex(Math.max(0, filteredSuggestions.length - 1));
    }
  }, [filteredSuggestions.length, cursorIndex]);

  // Auto-scroll functionality
  const scrollToItem = useCallback((index: number) => {
    const itemElement = itemRefs.current[index];
    if (itemElement) {
      itemElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, []);

  // Handle range selection (shift+click or shift+arrow)
  const handleRangeSelection = useCallback((startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    console.log('Range selection:', { start, end, filteredLength: filteredSuggestions.length });

    // Get the reference descriptions in the range
    const selectedDescriptions = new Set<string>();
    for (let i = start; i <= end; i++) {
      if (i >= 0 && i < filteredSuggestions.length) {
        const suggestion = filteredSuggestions[i];
        if (suggestion && suggestion.suggestedPath) {
          selectedDescriptions.add(suggestion.reference.description);
        }
      }
    }

    console.log('Selected descriptions:', Array.from(selectedDescriptions));

    // Update suggestions: select items in range, deselect others
    setSuggestions(prev => prev.map(suggestion => ({
      ...suggestion,
      isSelected: selectedDescriptions.has(suggestion.reference.description)
    })));
  }, [filteredSuggestions]);

  // Toggle individual suggestion selection
  const toggleSuggestionSelection = useCallback((suggestion: AutoMatchSuggestion) => {
    setSuggestions(prev => prev.map(s => 
      s.reference.description === suggestion.reference.description
        ? { ...s, isSelected: !s.isSelected }
        : s
    ));
  }, []);

  // Accept a single suggestion
  const acceptSuggestion = useCallback((suggestion: AutoMatchSuggestion) => {
    setSuggestions(prev => prev.map(s => 
      s.reference.description === suggestion.reference.description
        ? { ...s, isAccepted: true, isRejected: false, isSelected: false }
        : s
    ));
  }, []);

  // Reject a single suggestion
  const rejectSuggestion = useCallback((suggestion: AutoMatchSuggestion) => {
    setSuggestions(prev => prev.map(s => 
      s.reference.description === suggestion.reference.description
        ? { ...s, isRejected: true, isAccepted: false, isSelected: false }
        : s
    ));
  }, []);

  // Select all visible suggestions
  const selectAllVisible = useCallback(() => {
    const visibleDescriptions = new Set(filteredSuggestions.map(fs => fs.reference.description));
    setSuggestions(prev => prev.map(suggestion => ({
      ...suggestion,
      isSelected: visibleDescriptions.has(suggestion.reference.description)
    })));
  }, [filteredSuggestions]);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSuggestions(prev => prev.map(s => ({ ...s, isSelected: false })));
    setRangeAnchor(-1);
  }, []);

  // Bulk accept selected suggestions
  const bulkAcceptSelected = useCallback(() => {
    setSuggestions(prev => prev.map(s => 
      s.isSelected 
        ? { ...s, isAccepted: true, isRejected: false, isSelected: false }
        : s
    ));
  }, []);

  // Bulk reject selected suggestions
  const bulkRejectSelected = useCallback(() => {
    setSuggestions(prev => prev.map(s => 
      s.isSelected 
        ? { ...s, isRejected: true, isAccepted: false, isSelected: false }
        : s
    ));
  }, []);

  // Select high confidence suggestions
  const selectHighConfidence = useCallback(() => {
    const highConfidenceDescriptions = new Set(
      filteredSuggestions
        .filter(fs => fs.score >= 0.7 && fs.suggestedPath)
        .map(fs => fs.reference.description)
    );
    setSuggestions(prev => prev.map(suggestion => ({
      ...suggestion,
      isSelected: highConfidenceDescriptions.has(suggestion.reference.description)
    })));
  }, [filteredSuggestions]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (filteredSuggestions.length === 0) return;

    let handled = false;

    switch (event.key) {
      case 'ArrowDown':
        if (event.shiftKey) {
          // Shift+Down: Range selection downward
          event.preventDefault();
          if (cursorIndex < filteredSuggestions.length - 1) {
            const newCursor = cursorIndex + 1;
            if (rangeAnchor === -1) {
              setRangeAnchor(cursorIndex);
            }
            handleRangeSelection(rangeAnchor, newCursor);
            setCursorIndex(newCursor);
          }
        } else {
          // Down: Move cursor down
          event.preventDefault();
          if (cursorIndex < filteredSuggestions.length - 1) {
            setCursorIndex(cursorIndex + 1);
            setRangeAnchor(-1);
          }
        }
        handled = true;
        break;

      case 'ArrowUp':
        if (event.shiftKey) {
          // Shift+Up: Range selection upward
          event.preventDefault();
          if (cursorIndex > 0) {
            const newCursor = cursorIndex - 1;
            if (rangeAnchor === -1) {
              setRangeAnchor(cursorIndex);
            }
            handleRangeSelection(rangeAnchor, newCursor);
            setCursorIndex(newCursor);
          }
        } else {
          // Up: Move cursor up
          event.preventDefault();
          if (cursorIndex > 0) {
            setCursorIndex(cursorIndex - 1);
            setRangeAnchor(-1);
          }
        }
        handled = true;
        break;

      case ' ':
        // Space: Toggle selection at cursor
        event.preventDefault();
        const currentSuggestion = filteredSuggestions[cursorIndex];
        if (currentSuggestion) {
          toggleSuggestionSelection(currentSuggestion);
          setRangeAnchor(cursorIndex);
        }
        handled = true;
        break;

      case 'Enter':
        // Enter: Accept current suggestion
        event.preventDefault();
        const suggestionToAccept = filteredSuggestions[cursorIndex];
        if (suggestionToAccept) {
          acceptSuggestion(suggestionToAccept);
        }
        handled = true;
        break;

      case 'Delete':
      case 'Backspace':
        // Delete: Reject current suggestion
        event.preventDefault();
        const suggestionToReject = filteredSuggestions[cursorIndex];
        if (suggestionToReject) {
          rejectSuggestion(suggestionToReject);
        }
        handled = true;
        break;

      case 'a':
        if (event.ctrlKey || event.metaKey) {
          // Ctrl+A: Select all visible
          event.preventDefault();
          selectAllVisible();
          handled = true;
        }
        break;

      case 'Escape':
        // Escape: Clear all selections
        event.preventDefault();
        clearAllSelections();
        handled = true;
        break;
    }

    if (handled) {
      event.stopPropagation();
      scrollToItem(cursorIndex);
      
      // Debug logging
      console.log('Keyboard action:', event.key, {
        cursorIndex,
        rangeAnchor,
        filteredSuggestionsLength: filteredSuggestions.length,
        selectedCount: filteredSuggestions.filter(s => s.isSelected).length
      });
    }
  }, [cursorIndex, rangeAnchor, filteredSuggestions, handleRangeSelection, toggleSuggestionSelection, acceptSuggestion, rejectSuggestion, selectAllVisible, clearAllSelections, scrollToItem]);

  // Setup keyboard event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-scroll when cursor moves
  useEffect(() => {
    if (cursorIndex >= 0 && cursorIndex < filteredSuggestions.length) {
      const timeoutId = setTimeout(() => {
        scrollToItem(cursorIndex);
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [cursorIndex, scrollToItem, filteredSuggestions.length]);

  // Reset states when selections are cleared externally
  useEffect(() => {
    if (selectedCount === 0) {
      setRangeAnchor(-1);
    }
  }, [selectedCount]);

  // Helper functions for styling and status
  const getConfidenceColor = (score: number) => {
    if (score >= 0.7) return 'text-green-700 bg-green-100 border-green-300';
    if (score >= 0.4) return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    return 'text-red-700 bg-red-100 border-red-300';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 0.7) return '🟢';
    if (score >= 0.4) return '🟡';
    return '🔴';
  };

  const isSelected = (suggestion: AutoMatchSuggestion): boolean => {
    return suggestion.isSelected || false;
  };

  // Handle mouse clicks with proper shift handling
  const handleSuggestionClick = (suggestion: AutoMatchSuggestion, index: number, event: React.MouseEvent) => {
    // Prevent text selection when using Shift
    if (event.shiftKey) {
      event.preventDefault();
    }

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle individual selection
      toggleSuggestionSelection(suggestion);
      setCursorIndex(index);
      setRangeAnchor(index);
    } else if (event.shiftKey && rangeAnchor !== -1) {
      // Shift+Click: Range selection
      event.preventDefault();
      handleRangeSelection(rangeAnchor, index);
      setCursorIndex(index);
    } else {
      // Regular click: Clear selections and select this one
      if (!suggestion.isAccepted && !suggestion.isRejected) {
        clearAllSelections();
        toggleSuggestionSelection(suggestion);
      }
      setCursorIndex(index);
      setRangeAnchor(index);
    }
  };

  const handleConfirm = () => {
    const acceptedSuggestions = suggestions.filter(s => s.isAccepted);
    onAccept(acceptedSuggestions);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full h-5/6 m-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-emerald-700 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Auto Match Suggestions
              </h2>
              <p className="text-emerald-100 text-sm mt-1">
                Review and accept/reject mapping suggestions
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{autoMatchResult.suggestionsWithHighConfidence}</div>
                <div className="text-xs text-emerald-100">High (≥70%)</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{autoMatchResult.suggestionsWithMediumConfidence}</div>
                <div className="text-xs text-emerald-100">Medium (40-70%)</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{autoMatchResult.suggestionsWithLowConfidence}</div>
                <div className="text-xs text-emerald-100">Low (&lt;40%)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-50 border-b p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">Min Confidence:</span>
                <div className="w-32">
                  <Slider
                    value={minConfidence}
                    onValueChange={setMinConfidence}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                </div>
                <span className="text-sm text-gray-600 w-10">{minConfidence[0]}%</span>
              </div>
              
              <div className="text-sm text-gray-600">
                Showing {filteredSuggestions.length} of {suggestions.length}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Selected: {selectedCount} | Accepted: {acceptedCount} | Rejected: {rejectedCount}
              </span>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedCount > 0 && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Button size="sm" onClick={bulkAcceptSelected} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-1" />
                Accept Selected ({selectedCount})
              </Button>
              <Button size="sm" variant="destructive" onClick={bulkRejectSelected}>
                <X className="w-4 h-4 mr-1" />
                Reject Selected ({selectedCount})
              </Button>
              <Button size="sm" variant="outline" onClick={clearAllSelections}>
                Clear Selection
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={selectHighConfidence}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                Select High Confidence (≥70%)
              </Button>
            </div>
          )}
        </div>

        {/* Keyboard Instructions */}
        <div className="bg-blue-50 border-b p-2 text-xs text-blue-700">
          <div className="flex gap-4">
            <span><kbd>Space</kbd> select</span>
            <span><kbd>Shift+↑↓</kbd> range select</span>
            <span><kbd>Enter</kbd> accept</span>
            <span><kbd>Del</kbd> reject</span>
            <span><kbd>Ctrl+A</kbd> select all</span>
            <span><kbd>Esc</kbd> clear</span>
          </div>
        </div>

        {/* Suggestions List */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden focus:outline-none"
          tabIndex={0}
        >
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {filteredSuggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No suggestions match the current confidence filter.
                  <br />
                  Try lowering the minimum confidence threshold.
                </div>
              ) : (
                filteredSuggestions.map((suggestion, index) => {
                  const isItemSelected = isSelected(suggestion);
                  const isAccepted = suggestion.isAccepted;
                  const isRejected = suggestion.isRejected;
                  const isCursor = index === cursorIndex;
                  const parts = suggestion.suggestedPath.split('/');
                  const fileName = parts.pop() || '';
                  const folderPath = parts.join('/');

                  return (
                    <div
                      key={suggestion.reference.description}
                      ref={(el) => { itemRefs.current[index] = el; }}
                      className={`
                        border rounded-lg p-4 transition-all relative group
                        ${isItemSelected ? 'bg-blue-50 border-blue-300 border-2' : 'bg-white border-gray-200'}
                        ${isAccepted ? 'bg-green-50 border-green-300' : ''}
                        ${isRejected ? 'bg-red-50 border-red-300' : ''}
                        ${isCursor ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                        ${!isAccepted && !isRejected ? 'hover:bg-gray-50 cursor-pointer' : ''}
                      `}
                      onClick={(e) => handleSuggestionClick(suggestion, index, e)}
                      onMouseDown={(e) => {
                        if (e.shiftKey) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {/* Cursor indicator */}
                      {isCursor && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-md"></div>
                      )}

                      <div className="flex items-center gap-4">
                        {/* Selection checkbox or status */}
                        <div className="flex-shrink-0">
                          {isAccepted ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : isRejected ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <Checkbox
                              checked={isItemSelected}
                              onCheckedChange={() => toggleSuggestionSelection(suggestion)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>

                        {/* Reference description */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {suggestion.reference.description}
                          </div>
                          {suggestion.reference.date && (
                            <div className="text-xs text-gray-500">
                              Date: {suggestion.reference.date}
                            </div>
                          )}
                        </div>

                        {/* Arrow */}
                        <div className="flex-shrink-0 text-gray-400">
                          →
                        </div>

                        {/* Suggested file path */}
                        <div className="flex-1 min-w-0">
                          {suggestion.suggestedPath ? (
                            <>
                              <div className="text-xs text-gray-500 font-mono truncate">
                                {folderPath}/
                              </div>
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {fileName}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500 italic">
                              No suitable match found
                            </div>
                          )}
                        </div>

                        {/* Confidence score */}
                        <div className="flex-shrink-0">
                          {suggestion.suggestedPath && (
                            <Badge 
                              className={`text-xs ${getConfidenceColor(suggestion.score)}`}
                              variant="outline"
                            >
                              {getConfidenceIcon(suggestion.score)} {(suggestion.score * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>

                        {/* Individual actions */}
                        {!isAccepted && !isRejected && suggestion.suggestedPath && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-8 h-8 p-0 text-green-600 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptSuggestion(suggestion);
                              }}
                              title="Accept suggestion"
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-8 h-8 p-0 text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                rejectSuggestion(suggestion);
                              }}
                              title="Reject suggestion"
                            >
                              ✘
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t p-6 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {acceptedCount > 0 && (
              <span className="text-green-700 font-medium">
                {acceptedCount} mapping{acceptedCount !== 1 ? 's' : ''} ready to apply
              </span>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={isProcessing || acceptedCount === 0}
              className="bg-emerald-700 hover:bg-emerald-600"
            >
              {isProcessing ? 'Applying...' : `Apply ${acceptedCount} Mapping${acceptedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}