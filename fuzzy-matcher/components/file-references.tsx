// components/file-references.tsx - File References Component with Keyboard Navigation

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect, useRef, useCallback } from 'react';

interface FileReferencesProps {
  references: string[];
  selectedReferences: Array<{ item: string; order: number }>;
  currentReference: string | null;
  originalCount: number;
  onSelectReference: (reference: string) => void;
  onToggleSelection: (reference: string) => void;
  onSelectAll: () => void;
  onBulkSkip: () => void;
  onBulkDeselect: () => void;
  onDetectRemaining: () => void;
}

export function FileReferences({
  references,
  selectedReferences,
  currentReference,
  originalCount,
  onSelectReference,
  onToggleSelection,
  onSelectAll,
  onBulkSkip,
  onBulkDeselect,
  onDetectRemaining,
}: FileReferencesProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const selectedCount = selectedReferences.length;
  const totalCount = references.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  // Get visual order for numbering
  const getSelectionNumber = (reference: string): number | null => {
    const found = selectedReferences.find(item => item.item === reference);
    return found ? found.order : null;
  };

  const isGeneratedReference = (reference: string): boolean => {
    const index = references.indexOf(reference);
    return originalCount > 0 && index >= originalCount;
  };

  // Scroll focused item into view
  const scrollIntoView = useCallback((index: number) => {
    if (itemRefs.current[index]) {
      itemRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, []);

  // Handle range selection
  const handleRangeSelection = useCallback((startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    for (let i = start; i <= end; i++) {
      if (i >= 0 && i < references.length) {
        const reference = references[i];
        const isCurrentlySelected = selectedReferences.some(item => item.item === reference);
        
        // Only toggle if not already in desired state
        if (!isCurrentlySelected) {
          onToggleSelection(reference);
        }
      }
    }
  }, [references, selectedReferences, onToggleSelection]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      
      const isShiftPressed = e.shiftKey;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          const nextIndex = Math.min(focusedIndex + 1, references.length - 1);
          setFocusedIndex(nextIndex);
          scrollIntoView(nextIndex);
          
          if (isShiftPressed && lastSelectedIndex !== -1) {
            handleRangeSelection(lastSelectedIndex, nextIndex);
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          const prevIndex = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prevIndex);
          scrollIntoView(prevIndex);
          
          if (isShiftPressed && lastSelectedIndex !== -1) {
            handleRangeSelection(lastSelectedIndex, prevIndex);
          }
          break;
          
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < references.length) {
            const reference = references[focusedIndex];
            if (e.key === ' ') {
              onToggleSelection(reference);
              setLastSelectedIndex(focusedIndex);
            } else {
              onSelectReference(reference);
            }
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          onBulkDeselect();
          setLastSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, lastSelectedIndex, references, handleRangeSelection, onToggleSelection, onSelectReference, onBulkDeselect, scrollIntoView]);

  // Initialize focus on first item
  useEffect(() => {
    if (references.length > 0 && focusedIndex === -1) {
      setFocusedIndex(0);
    }
  }, [references.length, focusedIndex]);

  // Handle click selection
  const handleItemClick = (reference: string, index: number) => {
    setFocusedIndex(index);
    setLastSelectedIndex(index);
    onSelectReference(reference);
  };

  const handleToggleClick = (reference: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFocusedIndex(index);
    setLastSelectedIndex(index);
    onToggleSelection(reference);
  };

  return (
    <div 
      ref={containerRef}
      className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full"
      tabIndex={0}
    >
      {/* Header */}
      <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          📋 File References
        </h2>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
            className="data-[state=checked]:bg-white data-[state=checked]:text-emerald-700"
          />
          <Badge variant="secondary" className="bg-white/20 text-white">
            {selectedCount} selected
          </Badge>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 border-b px-3 py-2 text-xs text-blue-700">
          💡 Use ↑↓ arrows to navigate, Shift+↑↓ for range selection, Space to toggle, Enter to select
        </div>
      )}

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="bg-gray-50 border-b p-3 flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onBulkSkip} className="text-xs">
            ⏭ Skip Selected
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkDeselect} className="text-xs">
            ✕ Deselect All
          </Button>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={onDetectRemaining} className="text-xs">
              📄 Detect Remaining
            </Button>
          </div>
        </div>
      )}

      {/* References List */}
      <ScrollArea className="flex-1 p-3 min-h-0">
        {references.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            🎉 All references matched!
          </div>
        ) : (
          <div className="space-y-2">
            {references.map((reference, index) => {
              const isSelected = selectedReferences.some(item => item.item === reference);
              const isActive = reference === currentReference;
              const isGenerated = isGeneratedReference(reference);
              const selectionNumber = getSelectionNumber(reference);
              const isFocused = index === focusedIndex;

              return (
                <div
                  key={reference}
                  ref={(el) => (itemRefs.current[index] = el)}
                  className={`
                    bg-gray-50 border rounded-md p-3 cursor-pointer transition-all
                    hover:bg-gray-100 hover:border-emerald-300
                    ${isSelected ? 'bg-emerald-50 border-emerald-300 border-2' : ''}
                    ${isActive ? 'bg-green-50 border-green-300 border-2' : ''}
                    ${isSelected && isActive ? 'bg-gradient-to-r from-emerald-50 to-green-50' : ''}
                    ${isFocused ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                  `}
                  onClick={() => handleItemClick(reference, index)}
                >
                  <div className="flex items-center gap-3">
                    {/* Selection Indicator */}
                    {isSelected && selectionNumber ? (
                      <div className="bg-emerald-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                        {selectionNumber}
                      </div>
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleClick(reference, index, {} as React.MouseEvent)}
                        onClick={(e) => handleToggleClick(reference, index, e)}
                      />
                    )}

                    {/* Reference Text */}
                    <div className="flex-1 text-sm text-gray-700 leading-relaxed">
                      {reference}
                    </div>

                    {/* Type Badge */}
                    <Badge 
                      variant={isGenerated ? "default" : "secondary"}
                      className={isGenerated ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
                    >
                      {isGenerated ? "AUTO" : "ORIG"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}