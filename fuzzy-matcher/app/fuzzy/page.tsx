// pages/fuzzy-matcher.tsx
// Page component displaying the fuzzy matcher grid with advanced filtering

import React from 'react';
import { FuzzyMatcherGrid } from '@/components/fuzzy-matcher-grid';

export const FuzzyMatcherPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Page Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              AGGrid Advanced Filtering Demo
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Fuzzy matcher with multi-select, order persistence, and custom delimiter parsing
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Feature Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Features Implemented</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h3 className="font-medium text-blue-600">Multi-Select with Order</h3>
              <p className="text-sm text-gray-600">
                Click checkboxes to select items. Order numbers are automatically assigned and maintained.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-green-600">Delimiter Parsing</h3>
              <p className="text-sm text-gray-600">
                Use "/" in search: "documents/agreement" searches path "documents" and filename "agreement".
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-purple-600">Fuzzy Matching</h3>
              <p className="text-sm text-gray-600">
                Select "Fuzzy Match" filter option to find approximate matches with typo tolerance.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-orange-600">Default Filename Search</h3>
              <p className="text-sm text-gray-600">
                When no "/" delimiter is used, search automatically matches against filename only.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-red-600">Hidden ID Column</h3>
              <p className="text-sm text-gray-600">
                ID field is present in data structure but hidden from display as requested.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-indigo-600">Performance Optimized</h3>
              <p className="text-sm text-gray-600">
                Debounced filtering, caching, and virtualization for large datasets.
              </p>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-800 mb-4">Usage Instructions</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">1</span>
              <div>
                <strong>Basic Search:</strong> Type in any filter field to search filenames by default (e.g., "agreement")
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">2</span>
              <div>
                <strong>Path/File Search:</strong> Use "/" delimiter to search path and filename separately (e.g., "documents/pdf")
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">3</span>
              <div>
                <strong>Fuzzy Matching:</strong> Change filter dropdown from "Contains" to "Fuzzy Match" for typo-tolerant search
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">4</span>
              <div>
                <strong>Multi-Select:</strong> Check boxes to select items in order. Selected items show order numbers.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">5</span>
              <div>
                <strong>Advanced Filter:</strong> Use the Advanced Filter button for complex multi-column expressions
              </div>
            </div>
          </div>
        </div>

        {/* Grid Container */}
        <div className="bg-white rounded-lg shadow-sm" style={{ height: '600px' }}>
          <FuzzyMatcherGrid />
        </div>

        {/* Technical Details */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Technical Implementation</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="font-medium mb-2">Data Structure</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• FileReference interface with id, filePath, fileName, description</li>
                <li>• OrderedSelection type for multi-select with order persistence</li>
                <li>• Hidden ID column maintained in grid structure</li>
                <li>• Support for generated vs imported file references</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Filtering Features</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Custom textMatcher with "/" delimiter parsing logic</li>
                <li>• Fuzzy matching algorithm with configurable threshold</li>
                <li>• Debounced input (300ms) for performance optimization</li>
                <li>• Advanced filter support for complex expressions</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FuzzyMatcherPage;