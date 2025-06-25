// app/test-document-selector/page.tsx
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
          <div className="text-sm space-y-1">
            <p>• Try typing "agreement" in the global search</p>
            <p>• Try typing "contracts/agreement" to test delimiter parsing</p>
            <p>• Try typing "exhibit *" to test wildcard sorting</p>
            <p>• Use individual column filters for granular searching</p>
            <p>• Click "Advanced" to open the advanced filter builder</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow" style={{ height: '600px' }}>
          <DocumentSelectorGrid />
        </div>
      </div>
    </div>
  );
}