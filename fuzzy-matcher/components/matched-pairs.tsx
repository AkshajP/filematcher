// components/matched-pairs.tsx - Matched Pairs Component

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MatchedPair } from '@/lib/types';

interface MatchedPairsProps {
  matchedPairs: MatchedPair[];
  onRemoveMatch: (index: number) => void;
}

export function MatchedPairs({ matchedPairs, onRemoveMatch }: MatchedPairsProps) {
  console.log('MatchedPairs component received:', matchedPairs.length, 'pairs');
  
  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
           Completed Mappings
        </h2>
        <Badge className="bg-white/20 text-white">
          {matchedPairs.length}
        </Badge>
      </div>

      {/* Matched Pairs List */}
      <ScrollArea className="flex-1 p-3 min-h-0">
        {matchedPairs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No matches confirmed yet
          </div>
        ) : (
          <div className="space-y-3">
            {matchedPairs.map((pair, index) => {
              const parts = pair.path.split('/');
              const fileName = parts.pop() || '';
              const pathParts = parts.join('/');

              return (
                <div
                  key={pair.id} // Correction: Use a unique ID from the pair object
                  className="bg-green-50 border border-green-200 rounded-md p-4 relative group"
                >
                  {/* Remove Button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemoveMatch(index)}
                    title="Remove match"
                  >
                    ×
                  </Button>

                  {/* Reference with scroll fallback */}
                  <div className="font-medium text-emerald-700 text-sm mb-2 pr-8 break-all leading-relaxed overflow-x-auto max-w-full">
                    <div className="whitespace-pre-wrap">{pair.reference}</div>
                  </div>

                  {/* File Path with scroll fallback */}
                  <div className="text-xs text-gray-600 font-mono mb-2 leading-relaxed overflow-x-auto max-w-full">
                    <div className="break-all whitespace-pre-wrap">
                      <span className="text-gray-400">{pathParts}/</span>
                      <span className="text-gray-700 font-medium">{fileName}</span>
                    </div>
                  </div>

                  {/* Metadata with scroll fallback */}
                  <div className="flex flex-wrap items-center gap-2 overflow-x-auto max-w-full">
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {(pair.score * 100).toFixed(1)}%
                    </Badge>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {pair.method}
                    </Badge>
                    {pair.timestamp && (
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(pair.timestamp).toLocaleDateString()}
                      </span>
                    )}
                    {pair.originalDate && (
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50 flex-shrink-0">
                        <span className="break-all">{pair.originalDate}</span>
                      </Badge>
                    )}
                    {pair.originalReference && (
                      <Badge variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50 flex-shrink-0">
                        <span className="break-all">{pair.originalReference}</span>
                      </Badge>
                    )}
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