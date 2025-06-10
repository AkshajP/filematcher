// components/import-validation-dialog.tsx - Import Validation Dialog

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImportValidationResult, ImportOptions } from "@/lib/import-manager";
import { useState } from "react";

interface ImportValidationDialogProps {
  validationResult: ImportValidationResult;
  onImport: (options: ImportOptions) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ImportValidationDialog({
  validationResult,
  onImport,
  onCancel,
  isLoading = false
}: ImportValidationDialogProps) {
  const [options, setOptions] = useState<ImportOptions>({
  importExactMatches: true,
  importMissingAsSkipped: false,
  importPotentialMatches: false,
  restoreMissingReferences: true // Default to restoring missing references
});

  const { validationSummary, exactMatches, missingFiles, newFiles, potentialMatches, errors } = validationResult;

  const handleImport = () => {
    onImport(options);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-700 text-white p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            📁 Import Mappings Validation
          </h2>
          {validationResult.metadata && (
            <p className="text-emerald-100 text-sm mt-1">
              From: {validationResult.metadata.folderName} 
              ({new Date(validationResult.metadata.exportTimestamp).toLocaleDateString()})
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Validation Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{validationSummary.exactMatches}</div>
                <div className="text-sm text-green-600">Exact Matches</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{validationSummary.missingFiles}</div>
                <div className="text-sm text-red-600">Missing Files</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{validationSummary.missingReferences}</div>
                <div className="text-sm text-orange-600">Missing References</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{validationSummary.newFiles}</div>
                <div className="text-sm text-blue-600">New Files</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700">{validationSummary.pathChanges}</div>
                <div className="text-sm text-yellow-600">Path Changes</div>
            </div>
            </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-800 mb-2">⚠️ Validation Warnings</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import Options */}
            <div className="border rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Import Options</h3>
            <div className="space-y-3">
                <div className="flex items-center space-x-2">
                <Checkbox
                    id="exactMatches"
                    checked={options.importExactMatches}
                    onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, importExactMatches: !!checked }))
                    }
                />
                <label htmlFor="exactMatches" className="text-sm">
                    Import exact matches ({validationSummary.exactMatches} mappings)
                </label>
                </div>

                <div className="flex items-center space-x-2">
                <Checkbox
                    id="potentialMatches"
                    checked={options.importPotentialMatches}
                    onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, importPotentialMatches: !!checked }))
                    }
                    disabled={potentialMatches.length === 0}
                />
                <label htmlFor="potentialMatches" className="text-sm">
                    Import potential matches with path corrections ({potentialMatches.length} mappings)
                </label>
                </div>

                <div className="flex items-center space-x-2">
                <Checkbox
                    id="restoreMissingReferences"
                    checked={options.restoreMissingReferences}
                    onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, restoreMissingReferences: !!checked }))
                    }
                    disabled={validationResult.missingReferences?.length === 0}
                />
                <label htmlFor="restoreMissingReferences" className="text-sm">
                    Restore missing references from old mapping ({validationResult.missingReferences?.length || 0} references)
                </label>
                </div>

                <div className="flex items-center space-x-2">
                <Checkbox
                    id="missingAsSkipped"
                    checked={options.importMissingAsSkipped}
                    onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, importMissingAsSkipped: !!checked }))
                    }
                    disabled={missingFiles.length === 0}
                />
                <label htmlFor="missingAsSkipped" className="text-sm">
                    Skip references for missing files ({missingFiles.length} mappings)
                </label>
                </div>
            </div>
            </div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Exact Matches */}
            {exactMatches.length > 0 && (
              <div className="border rounded-lg">
                <div className="bg-green-50 border-b p-3">
                  <h4 className="font-medium text-green-800">✅ Exact Matches</h4>
                </div>
                <ScrollArea className="h-32 p-3">
                  <div className="space-y-1">
                    {exactMatches.slice(0, 10).map((path, index) => (
                      <div key={index} className="text-xs font-mono text-gray-600">
                        {path.split('/').pop()}
                      </div>
                    ))}
                    {exactMatches.length > 10 && (
                      <div className="text-xs text-gray-500">
                        ... and {exactMatches.length - 10} more
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Missing Files */}
            {missingFiles.length > 0 && (
              <div className="border rounded-lg">
                <div className="bg-red-50 border-b p-3">
                  <h4 className="font-medium text-red-800">❌ Missing Files</h4>
                </div>
                <ScrollArea className="h-32 p-3">
                  <div className="space-y-1">
                    {missingFiles.slice(0, 10).map((item, index) => (
                      <div key={index} className="text-xs">
                        <div className="font-medium text-gray-800">{item.reference}</div>
                        <div className="font-mono text-gray-500">{item.originalPath}</div>
                      </div>
                    ))}
                    {missingFiles.length > 10 && (
                      <div className="text-xs text-gray-500">
                        ... and {missingFiles.length - 10} more
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Missing References */}
                {validationResult.missingReferences && validationResult.missingReferences.length > 0 && (
                <div className="border rounded-lg">
                <div className="bg-orange-50 border-b p-3">
                    <h4 className="font-medium text-orange-800">🚫 Missing References</h4>
                    <p className="text-xs text-orange-600">These references existed in your old mapping but are not in your current client index</p>
                </div>
                <ScrollArea className="h-32 p-3">
                    <div className="space-y-1">
                    {validationResult.missingReferences.slice(0, 10).map((item, index) => (
                        <div key={index} className="text-xs border-l-2 border-orange-300 pl-2">
                        <div className="font-medium text-gray-800">{item.reference}</div>
                        <div className="font-mono text-gray-500">was mapped to: {item.path}</div>
                        </div>
                    ))}
                    {validationResult.missingReferences.length > 10 && (
                        <div className="text-xs text-gray-500">
                        ... and {validationResult.missingReferences.length - 10} more
                        </div>
                    )}
                    </div>
                </ScrollArea>
                </div>
                )}

            {/* Potential Matches */}
            {potentialMatches.length > 0 && (
              <div className="border rounded-lg md:col-span-2">
                <div className="bg-yellow-50 border-b p-3">
                  <h4 className="font-medium text-yellow-800">🔄 Potential Matches</h4>
                </div>
                <ScrollArea className="h-32 p-3">
                  <div className="space-y-2">
                    {potentialMatches.slice(0, 5).map((match, index) => (
                      <div key={index} className="text-xs border-l-2 border-yellow-300 pl-2">
                        <div className="font-medium text-gray-800">{match.reference}</div>
                        <div className="text-red-600">Was: {match.originalPath}</div>
                        <div className="text-green-600">Now: {match.suggestedPath}</div>
                      </div>
                    ))}
                    {potentialMatches.length > 5 && (
                      <div className="text-xs text-gray-500">
                        ... and {potentialMatches.length - 5} more
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        

        {/* Footer */}
        <div className="bg-gray-50 border-t p-6 flex justify-between">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={isLoading || (!options.importExactMatches && !options.importPotentialMatches)}
              className="bg-emerald-700 hover:bg-emerald-600"
            >
              {isLoading ? 'Importing...' : `Import Selected (${
                (options.importExactMatches ? validationSummary.exactMatches : 0) +
                (options.importPotentialMatches ? validationSummary.pathChanges : 0)
              } mappings)`}
            </Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}