// fuzzy-matcher/app/test-document-selector/page.tsx
'use client'

import React from 'react';
import { DocumentSelectorGrid } from '@/components/document-selector';

export default function TestDocumentSelectorPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Test Document Selector</h1>
        
        <div className="bg-yellow-100 border border-yellow-400 rounded p-4 mb-6">
          <h2 className="font-semibold mb-2">Test Instructions:</h2>
          <div className="text-sm space-y-1 mb-3">
            <p><strong>Search Testing:</strong></p>
            <p>• Try typing "contracts/" - should match files in contracts folder</p>
            <p>• Try typing "agreement" - should match filenames containing "agreement"</p>
            <p>• Try typing "contracts/agreement" - should match path AND filename</p>
            <p>• Try typing "exhibit *" - should match and sort by filename</p>
            <p>• Try typing "discovery/" - should match discovery folder files</p>
          </div>
          <div className="text-sm space-y-1">
            <p><strong>Multi-Select Testing:</strong></p>
            <p>• Click selection boxes to select files with order numbers</p>
            <p>• Hold Ctrl+Click to multi-select individual files</p>
            <p>• Hold Shift+Click to select ranges</p>
            <p>• Use arrow keys to navigate, Space to toggle selection</p>
            <p>• Shift+Arrow keys for keyboard range selection</p>
            <p>• Esc to clear all selections, Ctrl+A to select all</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow" style={{ height: '600px' }}>
          <DocumentSelectorGrid />
        </div>
      </div>
    </div>
  );
}