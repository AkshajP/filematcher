// components/file-references.tsx - File References Component

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const selectedCount = selectedReferences.length;
  const totalCount = references.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  // Get visual order for numbering
  const getSelectionNumber = (reference: string): number | null => {
  const found = selectedReferences.find(item => item.item === reference);
  return found ? found.order : null;
};

  const isGeneratedReference = (reference: string): boolean => {
    const index = references.indexOf(reference);
    return originalCount > 0 && index >= originalCount;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full">
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
            {references.map((reference) => {
              const isSelected = selectedReferences.some(item => item.item === reference);
              const isActive = reference === currentReference;
              const isGenerated = isGeneratedReference(reference);
              const selectionNumber = getSelectionNumber(reference);

              return (
                <div
                  key={reference}
                  className={`
                    bg-gray-50 border rounded-md p-3 cursor-pointer transition-all
                    hover:bg-gray-100 hover:border-emerald-300
                    ${isSelected ? 'bg-emerald-50 border-emerald-300 border-2' : ''}
                    ${isActive ? 'bg-green-50 border-green-300 border-2' : ''}
                    ${isSelected && isActive ? 'bg-gradient-to-r from-emerald-50 to-green-50' : ''}
                  `}
                  onClick={() => onSelectReference(reference)}
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
                        onCheckedChange={() => onToggleSelection(reference)}
                        onClick={(e) => e.stopPropagation()}
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