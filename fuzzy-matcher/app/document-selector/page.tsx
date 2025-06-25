// app/document-selector/page.tsx
'use client'

import React from 'react';
import { DocumentSelectorGrid } from '@/components/document-selector';

export default function DocumentSelectorPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Page Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Document Selector with AG Grid
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Intuitive document search with slash delimiter parsing and wildcard sorting
            </p>
          </div>
        </div>
      </header>

      {/* Feature Overview */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Search Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <h3 className="font-medium text-blue-600">Default File Search</h3>
              <p className="text-sm text-gray-600">
                Type "agreement" to search file names containing "agreement"
              </p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">agreement</code>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-green-600">Path/File Search</h3>
              <p className="text-sm text-gray-600">
                Use "/" to search path and filename separately
              </p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">contracts/agreement</code>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-purple-600">Wildcard Sorting</h3>
              <p className="text-sm text-gray-600">
                Add "*" to search and sort results by filename
              </p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">exhibit *</code>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-orange-600">Combined Search</h3>
              <p className="text-sm text-gray-600">
                Combine path, filename, and sorting
              </p>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">discovery/exhibit *</code>
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-800 mb-4">Search Examples</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">Basic Search Examples:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <code className="bg-white px-2 py-1 rounded text-blue-700 min-w-[120px]">agreement</code>
                  <span className="text-gray-600">→ Files containing "agreement"</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-white px-2 py-1 rounded text-blue-700 min-w-[120px]">witness</code>
                  <span className="text-gray-600">→ Files containing "witness"</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-white px-2 py-1 rounded text-blue-700 min-w-[120px]">exhibit *</code>
                  <span className="text-gray-600">→ Files with "exhibit" sorted by name</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-3">Path/File Search Examples:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <code className="bg-white px-2 py-1 rounded text-blue-700 min-w-[120px]">contracts/</code>
                  <span className="text-gray-600">→ All files in contracts folder</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-white px-2 py-1 rounded text-blue-700 min-w-[120px]">exhibits/witness</code>
                  <span className="text-gray-600">→ "witness" files in exhibits folder</span>
                </div>
                <div className="flex items-center gap-3">
                  <code className="bg-white px-2 py-1 rounded text-blue-700 min-w-[120px]">discovery/exhibit *</code>
                  <span className="text-gray-600">→ "exhibit" files in discovery, sorted</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-amber-800 mb-4">How to Use</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">1</span>
              <div>
                <strong>Global Search:</strong> Use the main search box at the top for intelligent parsing
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">2</span>
              <div>
                <strong>Column Filters:</strong> Use individual column filters for granular searching
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">3</span>
              <div>
                <strong>Advanced Filter:</strong> Click "Advanced" button for complex multi-column expressions
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">4</span>
              <div>
                <strong>Selection:</strong> Use checkboxes to select multiple documents
              </div>
            </div>
          </div>
        </div>

        {/* Document Grid */}
        <div className="bg-white rounded-lg shadow-sm" style={{ height: '700px' }}>
          <DocumentSelectorGrid />
        </div>

        {/* Technical Details */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Technical Implementation</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-medium mb-2">Search Parser</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Slash delimiter detection</li>
                <li>• Wildcard pattern recognition</li>
                <li>• Automatic filter model generation</li>
                <li>• Sort model creation for wildcards</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">AG Grid Features</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Floating filters on all columns</li>
                <li>• Advanced filter builder</li>
                <li>• Multi-row selection</li>
                <li>• Debounced filtering (300ms)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Performance</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Row virtualization</li>
                <li>• Filter result caching</li>
                <li>• Optimized rendering</li>
                <li>• Minimal re-renders</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}