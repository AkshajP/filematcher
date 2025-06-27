// app/new-mapper/page.tsx
'use client'

import React, { useState, useCallback } from 'react';
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
    const allSelected = selectedReferences.length === fileReferences.length;
    if (allSelected) {
      setSelectedReferences([]);
    } else {
      const newSelected = fileReferences.map((ref, index) => ({
        item: ref,
        order: index + 1
      }));
      setSelectedReferences(newSelected);
    }
    setSelectedDocuments([]);
  }, [selectedReferences.length, fileReferences]);

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
    // Create mappings based on current selections
    if (selectedReferences.length > 0 && selectedDocuments.length > 0) {
      // Bulk mapping: pair references and documents by order
      const sortedRefs = selectedReferences.sort((a, b) => a.order - b.order);
      const sortedDocs = selectedDocuments.sort((a, b) => a.order - b.order);
      
      const newMappings: MatchedPair[] = [];
      const maxPairs = Math.min(sortedRefs.length, sortedDocs.length);
      
      for (let i = 0; i < maxPairs; i++) {
        newMappings.push({
          reference: sortedRefs[i].item.description,
          path: sortedDocs[i].item.filePath,
          score: 1.0, // Manual mapping gets perfect score
          timestamp: new Date().toISOString(),
          method: selectedReferences.length > 1 ? 'manual-bulk' : 'manual',
          originalDate: sortedRefs[i].item.date,
          originalReference: sortedRefs[i].item.reference,
        });
      }
      
      setMatchedPairs(prev => [...prev, ...newMappings]);
      setSelectedReferences([]);
      setSelectedDocuments([]);
      
      console.log(`Created ${newMappings.length} new mappings`);
    } else if (currentReference && selectedDocuments.length === 1) {
      // Single mapping
      const newMapping: MatchedPair = {
        reference: currentReference.description,
        path: selectedDocuments[0].item.filePath,
        score: 1.0,
        timestamp: new Date().toISOString(),
        method: 'manual',
        originalDate: currentReference.date,
        originalReference: currentReference.reference,
      };
      
      setMatchedPairs(prev => [...prev, newMapping]);
      setSelectedDocuments([]);
      
      console.log('Created single mapping:', newMapping);
    }
  }, [selectedReferences, selectedDocuments, currentReference]);

  // Remove matched pair
  const handleRemoveMatch = useCallback((index: number) => {
    setMatchedPairs(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Get unmatched references for the FileReferences component
  const unmatchedReferences = fileReferences.filter(ref => 
    !matchedPairs.some(pair => pair.reference === ref.description)
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-emerald-700 px-8 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-emerald-700">
            New TERES File Mapper
          </h1>
          <div className="flex gap-2">
            <Badge variant="outline">
              {matchedPairs.length} / {fileReferences.length} Mapped
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - File References */}
        <div className="w-1/3 border-r bg-white">
          <FileReferences 
            references={unmatchedReferences}
            selectedReferences={selectedReferences}
            currentReference={currentReference}
            originalCount={fileReferences.length}
            onSelectReference={handleSelectReference}
            onToggleSelection={handleToggleReferenceSelection}
            onSelectAll={handleSelectAllReferences}
            onBulkSkip={handleBulkSkip}
            onBulkDeselect={handleBulkDeselect}
            onDetectRemaining={handleDetectRemaining}
          />
        </div>

        {/* Right Panel - Tabbed Content */}
        <div className="flex-1 flex flex-col">
          {/* Tab Headers */}
          <div className="bg-white border-b flex">
            <button
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'matching'
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('matching')}
            >
              Match Mapping
              {(selectedReferences.length > 0 || currentReference) && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">
                  {selectedReferences.length > 0 ? selectedReferences.length : 1}
                </Badge>
              )}
            </button>
            <button
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
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
                {/* Current References Display */}
                {(currentReference || selectedReferences.length > 0) && (
                  <div className="bg-green-50 border-b border-green-200 p-3">
                    <div className="flex items-center justify-between">
                      {selectedReferences.length > 0 ? (
                        (() => {
                          // Find the next reference to map based on selection order
                          const sortedRefs = selectedReferences.sort((a, b) => a.order - b.order);
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
                                All references mapped
                              </h4>
                            );
                          }
                        })()
                      ) : currentReference ? (
                        <h4 className="text-sm font-semibold text-green-700 flex-1 truncate">
                          Currently mapping (1) {currentReference.description}
                        </h4>
                      ) : null}
                      
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs ml-2 flex-shrink-0">
                        {selectedReferences.length > 0 ? `${selectedReferences.length} selected` : 'Single mode'}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Document Selector */}
                <div className="flex-1">
                  <NewDocumentSelector
                    documentFiles={documentFiles}
                    selectedDocuments={selectedDocuments}
                    onSelectionChange={handleDocumentSelectionChange}
                    currentReferences={selectedReferences.length > 0 ? selectedReferences : (currentReference ? [{ item: currentReference, order: 1 }] : [])}
                    onConfirmMapping={handleConfirmMapping}
                  />
                </div>
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