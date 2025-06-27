// app/new-mapper/page.tsx
'use client'

import React, { useState, useCallback, useMemo } from 'react';
import { FileReferences } from '@/components/file-references';
import { NewDocumentSelector } from '@/components/new-document-selector';
import { MatchedPairs } from '@/components/matched-pairs';
import { Badge } from '@/components/ui/badge';
import { FileReference, MatchedPair, generateUniqueId } from '@/lib/types';

interface OrderedSelection {
  item: DocumentFile;
  order: number;
}

interface DocumentFile {
  id: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  dateModified?: string;
  fileType?: string;
}

type ActiveTab = 'matching' | 'completed';

// Generate placeholder file references (client index) - deterministic data
const generatePlaceholderReferences = (): FileReference[] => {
  const descriptions = [
    'Service Agreement Contract 2024',
    'Witness Statement from John Smith regarding accident',
    'Financial Report Q1 2024 - Revenue Analysis',
    'Technical Specification Document for Software License',
    'Legal Brief - Motion to Dismiss Case #2024-001',
    'Evidence Photo - Accident Scene Overview',
    'Client Correspondence - Agreement Draft Review',
    'Expert Witness Deposition Transcript',
    'Insurance Policy Documentation',
    'Medical Records - Patient Treatment Summary'
  ];

  // Deterministic dates based on index
  const deterministicDates = [
    '2024-01-15', '2024-02-20', '2024-03-10', '2024-04-05', '2024-05-18',
    '2024-06-12', '2024-07-08', '2024-08-25', '2024-09-14', '2024-10-30'
  ];

  return descriptions.map((desc, index) => ({
    id: `ref-${index}-${desc.slice(0, 10).replace(/\s/g, '')}`,
    description: desc,
    date: index % 3 === 0 ? deterministicDates[index % deterministicDates.length] : undefined,
    reference: index % 4 === 0 ? `REF-${String(index + 1).padStart(3, '0')}` : undefined,
    isGenerated: false
  }));
};

// Generate placeholder document files (file paths from folder) - deterministic data
const generatePlaceholderDocuments = (): DocumentFile[] => {
  const sampleFiles = [
    { path: '/contracts/legal/service-agreement-2024.pdf', type: 'pdf', size: 1024000 },
    { path: '/contracts/legal/nda-template.docx', type: 'docx', size: 512000 },
    { path: '/contracts/vendor/software-license.pdf', type: 'pdf', size: 768000 },
    { path: '/exhibits/evidence/witness-statement-1.pdf', type: 'pdf', size: 2048000 },
    { path: '/exhibits/evidence/witness-statement-2.pdf', type: 'pdf', size: 1536000 },
    { path: '/exhibits/photos/accident-scene.jpg', type: 'jpg', size: 3072000 },
    { path: '/exhibits/photos/damage-assessment.jpg', type: 'jpg', size: 2560000 },
    { path: '/reports/financial/quarterly-report-q1.xlsx', type: 'xlsx', size: 768000 },
    { path: '/reports/financial/quarterly-report-q2.xlsx', type: 'xlsx', size: 832000 },
    { path: '/reports/technical/system-analysis.docx', type: 'docx', size: 1024000 },
    { path: '/correspondence/client/agreement-draft.docx', type: 'docx', size: 256000 },
    { path: '/correspondence/client/agreement-final.pdf', type: 'pdf', size: 1280000 },
    { path: '/correspondence/vendor/proposal-request.pdf', type: 'pdf', size: 640000 },
    { path: '/discovery/documents/exhibit-a-contract.pdf', type: 'pdf', size: 1792000 },
    { path: '/discovery/documents/exhibit-b-correspondence.pdf', type: 'pdf', size: 640000 },
    { path: '/discovery/documents/exhibit-c-financial.xlsx', type: 'xlsx', size: 896000 },
    { path: '/discovery/depositions/witness-a.pdf', type: 'pdf', size: 3200000 },
    { path: '/pleadings/motions/motion-to-dismiss.pdf', type: 'pdf', size: 1152000 },
    { path: '/pleadings/briefs/opening-brief.docx', type: 'docx', size: 2304000 },
    { path: '/transcripts/depositions/witness-deposition-smith.pdf', type: 'pdf', size: 4096000 },
    { path: '/transcripts/hearings/preliminary-hearing.pdf', type: 'pdf', size: 3584000 }
  ];

  // Deterministic dates based on index
  const deterministicDates = [
    '2024-01-10', '2024-01-15', '2024-01-20', '2024-02-05', '2024-02-12',
    '2024-02-18', '2024-03-03', '2024-03-10', '2024-03-15', '2024-04-02',
    '2024-04-08', '2024-04-15', '2024-05-01', '2024-05-10', '2024-05-18',
    '2024-06-05', '2024-06-12', '2024-06-20', '2024-07-03', '2024-07-15',
    '2024-08-01'
  ];

  return sampleFiles.map((file, index) => {
    const pathParts = file.path.split('/');
    const fileName = pathParts.pop() || '';
    
    const generateStableId = (path: string): string => {
      let hash = 0;
      for (let i = 0; i < path.length; i++) {
        const char = path.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `doc-${Math.abs(hash)}-${index}`;
    };

    return {
      id: generateStableId(file.path),
      filePath: file.path,
      fileName,
      fileSize: file.size,
      dateModified: deterministicDates[index % deterministicDates.length],
      fileType: file.type
    };
  });
};

export default function NewMapperPage() {
  // Placeholder data
  const [fileReferences] = useState<FileReference[]>(generatePlaceholderReferences());
  const [documentFiles] = useState<DocumentFile[]>(generatePlaceholderDocuments());
  
  // State management
  const [selectedReferences, setSelectedReferences] = useState<Array<{ item: FileReference; order: number }>>([]);
  const [currentReference, setCurrentReference] = useState<FileReference | null>(fileReferences[0] || null);
  const [selectedDocuments, setSelectedDocuments] = useState<OrderedSelection[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<MatchedPair[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('matching');
  
  // NEW: Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(33); // Default 33% width
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [startX, setStartX] = useState<number>(0);
  const [startWidth, setStartWidth] = useState<number>(33);

  // Get unmatched references for the FileReferences component
  const unmatchedReferences = useMemo(() => {
    return fileReferences.filter(ref => 
      !matchedPairs.some(pair => pair.reference === ref.description)
    );
  }, [fileReferences, matchedPairs]);

  // NEW: Filter current selections to only include unmapped references
  const validSelectedReferences = useMemo(() => {
    return selectedReferences.filter(sel => 
      unmatchedReferences.some(ref => ref.id === sel.item.id)
    );
  }, [selectedReferences, unmatchedReferences]);

  const validCurrentReference = useMemo(() => {
    if (!currentReference) return null;
    return unmatchedReferences.find(ref => ref.id === currentReference.id) || null;
  }, [currentReference, unmatchedReferences]);

  // NEW: Check if there are any valid references to map
  const hasValidReferencesToMap = useMemo(() => {
    return validSelectedReferences.length > 0 || validCurrentReference !== null;
  }, [validSelectedReferences.length, validCurrentReference]);

  // NEW: Auto-manage state when references become mapped/unmapped
  React.useEffect(() => {
    // Clear selected references that are no longer valid
    if (validSelectedReferences.length !== selectedReferences.length) {
      setSelectedReferences(validSelectedReferences);
    }
    
    // Handle current reference state changes
    if (currentReference && !validCurrentReference) {
      // Current reference became invalid (was mapped) - set to first available or null
      setCurrentReference(unmatchedReferences[0] || null);
    } else if (!currentReference && unmatchedReferences.length > 0 && validSelectedReferences.length === 0) {
      // No current reference but unmapped references are available (e.g., after deleting a mapping)
      // Auto-set to first unmapped reference to restore mapping interface
      setCurrentReference(unmatchedReferences[0]);
    }
    
    // Clear document selections when there are no valid references
    if (!hasValidReferencesToMap && selectedDocuments.length > 0) {
      setSelectedDocuments([]);
    }
  }, [validSelectedReferences, validCurrentReference, hasValidReferencesToMap, selectedReferences, currentReference, unmatchedReferences, selectedDocuments.length]);

  // File References handlers
  const handleSelectReference = useCallback((reference: FileReference) => {
    setCurrentReference(reference);
    setSelectedReferences([]);
    setSelectedDocuments([]);
  }, []);

  const handleToggleReferenceSelection = useCallback((reference: FileReference) => {
    setSelectedReferences(prev => {
      const existing = prev.find(item => item.item.id === reference.id);
      if (existing) {
        return prev.filter(item => item.item.id !== reference.id);
      } else {
        const usedOrders = new Set(prev.map(item => item.order));
        let nextOrder = 1;
        while (usedOrders.has(nextOrder)) {
          nextOrder++;
        }
        return [...prev, { item: reference, order: nextOrder }];
      }
    });
    setSelectedDocuments([]);
  }, []);

  const handleSelectAllReferences = useCallback(() => {
    const allSelected = selectedReferences.length === unmatchedReferences.length;
    if (allSelected) {
      setSelectedReferences([]);
    } else {
      const newSelected = unmatchedReferences.map((ref, index) => ({
        item: ref,
        order: index + 1
      }));
      setSelectedReferences(newSelected);
    }
    setSelectedDocuments([]);
  }, [selectedReferences.length, unmatchedReferences]);

  const handleBulkSkip = useCallback(() => {
    // TODO: Implement bulk skip logic
    console.log('Bulk skip selected references:', selectedReferences);
    setSelectedReferences([]);
  }, [selectedReferences]);

  const handleBulkDeselect = useCallback(() => {
    setSelectedReferences([]);
    setSelectedDocuments([]);
  }, []);

  const handleDetectRemaining = useCallback(() => {
    // TODO: Implement detect remaining files logic
    console.log('Detect remaining files');
  }, []);

  // Document selector handlers
  const handleDocumentSelectionChange = useCallback((selections: OrderedSelection[]) => {
    setSelectedDocuments(selections);
    console.log('Document selections changed:', selections);
  }, []);

  const handleConfirmMapping = useCallback(() => {
    // NEW: Only proceed if there are valid references to map
    if (!hasValidReferencesToMap) {
      console.log('No valid references to map');
      return;
    }

    // Create mappings based on current selections
    if (validSelectedReferences.length > 0 && selectedDocuments.length > 0) {
      // Bulk mapping: pair references and documents by order
      const sortedRefs = validSelectedReferences.sort((a, b) => a.order - b.order);
      const sortedDocs = selectedDocuments.sort((a, b) => a.order - b.order);
      
      const newMappings: MatchedPair[] = [];
      const maxPairs = Math.min(sortedRefs.length, sortedDocs.length);
      
      for (let i = 0; i < maxPairs; i++) {
        newMappings.push({
          reference: sortedRefs[i].item.description,
          path: sortedDocs[i].item.filePath,
          score: 1.0, // Manual mapping gets perfect score
          timestamp: new Date().toISOString(),
          method: validSelectedReferences.length > 1 ? 'manual-bulk' : 'manual',
          originalDate: sortedRefs[i].item.date,
          originalReference: sortedRefs[i].item.reference,
        });
      }
      
      setMatchedPairs(prev => [...prev, ...newMappings]);
      setSelectedReferences([]);
      setSelectedDocuments([]);
      
      console.log(`Created ${newMappings.length} new mappings`);
    } else if (validCurrentReference && selectedDocuments.length === 1) {
      // Single mapping
      const newMapping: MatchedPair = {
        reference: validCurrentReference.description,
        path: selectedDocuments[0].item.filePath,
        score: 1.0,
        timestamp: new Date().toISOString(),
        method: 'manual',
        originalDate: validCurrentReference.date,
        originalReference: validCurrentReference.reference,
      };
      
      setMatchedPairs(prev => [...prev, newMapping]);
      setSelectedDocuments([]);
      
      console.log('Created single mapping:', newMapping);
    }
  }, [validSelectedReferences, selectedDocuments, validCurrentReference, hasValidReferencesToMap]);

  // Remove matched pair
  const handleRemoveMatch = useCallback((index: number) => {
    setMatchedPairs(prev => prev.filter((_, i) => i !== index));
  }, []);

  // NEW: Resize handling functions
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(leftPanelWidth);
    e.preventDefault();
  }, [leftPanelWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const containerWidth = window.innerWidth;
    const newWidthPercent = startWidth + (deltaX / containerWidth) * 100;
    
    // Constrain between 20% and 60%
    const constrainedWidth = Math.min(Math.max(newWidthPercent, 20), 60);
    setLeftPanelWidth(constrainedWidth);
  }, [isResizing, startX, startWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add global mouse event listeners for resizing
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-emerald-700 px-8 py-2 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-emerald-700">
            TERES File Mapper
          </h1>
          <div className="flex gap-2">
            <Badge variant="outline">
              {matchedPairs.length} / {fileReferences.length} Mapped
            </Badge>
            {unmatchedReferences.length === 0 ? (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                All Complete!
              </Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                {unmatchedReferences.length} Remaining
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - File References (Resizable) */}
        <div 
          className="bg-white border-r transition-all duration-200 ease-in-out"
          style={{ 
            width: `${leftPanelWidth}%`,
            minWidth: '200px',
            maxWidth: '800px'
          }}
        >
          <FileReferences 
            references={unmatchedReferences}
            selectedReferences={validSelectedReferences}
            currentReference={validCurrentReference}
            originalCount={fileReferences.length}
            onSelectReference={handleSelectReference}
            onToggleSelection={handleToggleReferenceSelection}
            onSelectAll={handleSelectAllReferences}
            onBulkSkip={handleBulkSkip}
            onBulkDeselect={handleBulkDeselect}
            onDetectRemaining={handleDetectRemaining}
          />
        </div>

        {/* Resize Handle */}
        <div
          className={`
            w-1 bg-gray-200 hover:bg-emerald-400 cursor-col-resize transition-colors duration-200
            ${isResizing ? 'bg-emerald-500' : ''}
            flex items-center justify-center relative group
          `}
          onMouseDown={handleMouseDown}
        >
          {/* Resize handle visual indicator */}
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
            <div className="w-1 h-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            </div>
          </div>
          
          {/* Resize tooltip on hover */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            Drag to resize
          </div>
        </div>

        {/* Right Panel - Tabbed Content */}
        <div 
          className="flex flex-col transition-all duration-200 ease-in-out"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          {/* Tab Headers */}
          <div className="bg-white border-b flex">
            <button
              className={`px-6 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'matching'
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('matching')}
            >
              Match Mapping
              {hasValidReferencesToMap && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">
                  {validSelectedReferences.length > 0 ? validSelectedReferences.length : 1}
                </Badge>
              )}
            </button>
            <button
              className={`px-6 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('completed')}
            >
              Completed Mappings
              <Badge className="ml-2 bg-green-100 text-green-800">
                {matchedPairs.length}
              </Badge>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'matching' ? (
              <div className="h-full flex flex-col">
                {/* NEW: Only show current references display if there are valid references */}
                {hasValidReferencesToMap ? (
                  <div className="bg-green-50 border-b border-green-200 p-2">
                    <div className="flex items-center justify-between">
                      {validSelectedReferences.length > 0 ? (
                        (() => {
                          // Find the next reference to map based on selection order
                          const sortedRefs = validSelectedReferences.sort((a, b) => a.order - b.order);
                          const nextRefIndex = selectedDocuments.length; // Next reference to map
                          const nextRef = sortedRefs[nextRefIndex];
                          
                          if (nextRef) {
                            return (
                              <h4 className="text-sm font-semibold text-green-700 flex-1 truncate">
                                Currently mapping ({nextRef.order}) {nextRef.item.description}
                              </h4>
                            );
                          } else {
                            return (
                              <h4 className="text-sm font-semibold text-green-700">
                                All selected references mapped - confirm to complete
                              </h4>
                            );
                          }
                        })()
                      ) : validCurrentReference ? (
                        <h4 className="text-sm font-semibold text-green-700 flex-1 truncate">
                          Currently mapping (1) {validCurrentReference.description}
                        </h4>
                      ) : null}
                      
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs ml-2 flex-shrink-0">
                        {validSelectedReferences.length > 0 ? `${validSelectedReferences.length} selected` : 'Single mode'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  // NEW: Show completion message when no valid references remain
                  <div className="bg-emerald-50 border-b border-emerald-200 p-6 text-center">
                    <h3 className="text-lg font-semibold text-emerald-700 mb-2">
                      🎉 All References Mapped!
                    </h3>
                    <p className="text-sm text-emerald-600">
                      All {fileReferences.length} references have been successfully mapped to documents.
                      Check the "Completed Mappings" tab to review your work.
                    </p>
                  </div>
                )}

                {/* Document Selector - Only show if there are valid references */}
                {hasValidReferencesToMap ? (
                  <div className="flex-1">
                    <NewDocumentSelector
                      documentFiles={documentFiles}
                      selectedDocuments={selectedDocuments}
                      onSelectionChange={handleDocumentSelectionChange}
                      currentReferences={validSelectedReferences.length > 0 ? validSelectedReferences : (validCurrentReference ? [{ item: validCurrentReference, order: 1 }] : [])}
                      onConfirmMapping={handleConfirmMapping}
                      matchedPairs={matchedPairs}
                    />
                  </div>
                ) : (
                  // NEW: Show placeholder when mapping is complete
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
                    <div className="text-center text-gray-500">
                      <div className="text-6xl mb-4">✅</div>
                      <h3 className="text-xl font-medium mb-2">Mapping Complete</h3>
                      <p className="text-sm">No more references to map</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <MatchedPairs 
                matchedPairs={matchedPairs}
                onRemoveMatch={handleRemoveMatch}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}