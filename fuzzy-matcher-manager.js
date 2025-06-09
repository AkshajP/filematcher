// fuzzy-matcher-manager.js - Web Worker Manager

class FuzzyMatcherManager {
    constructor() {
        this.worker = null;
        this.callbacks = new Map();
        this.requestId = 0;
        this.isSupported = typeof Worker !== 'undefined';

        if (this.isSupported) {
            this.initWorker();
        } else {
            console.warn('Web Workers not supported, falling back to main thread');
        }
    }

    initWorker() {
        try {
            // Check if we're running from file:// protocol
            if (window.location.protocol === 'file:') {
                console.warn('Web Workers not supported with file:// protocol. Using main thread fallback.');
                this.isSupported = false;
                return;
            }

            this.worker = new Worker('fuzzy-matcher-worker.js');

            this.worker.onmessage = (e) => {
                const { type, results, requestId } = e.data;

                if (type === 'searchResults' && this.callbacks.has('search')) {
                    const callback = this.callbacks.get('search');
                    this.callbacks.delete('search');
                    // *** FIX: Wrap the worker's array in the standard object format ***
                    callback({ results: results, suggestions: [] });
                } else if (type === 'bulkMatchResults' && this.callbacks.has(`bulk-${requestId}`)) {
                    const callback = this.callbacks.get(`bulk-${requestId}`);
                    this.callbacks.delete(`bulk-${requestId}`);
                    callback(results);
                }
            };

            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                this.isSupported = false;
                // Clear all pending callbacks with error
                for (const [key, callback] of this.callbacks) {
                    callback(null, error);
                    this.callbacks.delete(key);
                }
            };

        } catch (error) {
            console.error('Failed to initialize worker:', error);
            this.isSupported = false;
        }
    }

    search(searchTerm, callback) {
        // Check if data is loaded
        if (!window.filePaths || window.filePaths.length === 0) {
            console.error('File paths not loaded yet');
            callback([]);
            return;
        }

        if (!this.isSupported || !this.worker) {
            // Fallback to main thread
            console.log('Using main thread for search');
            // Check if searchMatches function exists
            if (typeof searchMatches !== 'function') {
                console.error('searchMatches function not found. Make sure fuzzy-matcher.js is loaded.');
                callback([]);
                return;
            }
            const results = searchMatches(searchTerm);
            callback(results);
            return;
        }

        // Cancel any pending search
        if (this.callbacks.has('search')) {
            const pendingCallback = this.callbacks.get('search');
            pendingCallback([]); // Return empty results for cancelled search
        }

        this.callbacks.set('search', callback);

        try {
            this.worker.postMessage({
                type: 'search',
                data: {
                    searchTerm,
                    filePaths: window.filePaths,
                    usedPaths: Array.from(window.usedFilePaths || [])
                }
            });
        } catch (error) {
            console.error('Failed to post message to worker:', error);
            this.isSupported = false;
            // Fallback to main thread
            if (typeof searchMatches !== 'function') {
                console.error('searchMatches function not found. Make sure fuzzy-matcher.js is loaded.');
                callback([]);
                return;
            }
            const results = searchMatches(searchTerm);
            callback(results);
        }
    }

    bulkMatch(references, threshold, callback) {
        if (!this.isSupported || !this.worker) {
            // Fallback to main thread
            const results = this.performBulkMatchMainThread(references, threshold);
            callback(results);
            return;
        }

        const requestId = this.requestId++;
        this.callbacks.set(`bulk-${requestId}`, callback);

        this.worker.postMessage({
            type: 'bulkMatch',
            data: {
                references,
                filePaths: window.filePaths,
                // Add the list of used paths to the message
                usedPaths: Array.from(window.usedFilePaths || []),
                threshold,
                requestId
            }
        });
    }

    // Fallback implementation for main thread
    performBulkMatchMainThread(references, threshold) {
        const results = [];

        // Check if searchMatches function exists
        if (typeof searchMatches !== 'function') {
            console.error('searchMatches function not found for bulk matching');
            return results;
        }

        for (const reference of references) {
            const matches = searchMatches(reference);
            const validMatches = matches.filter(m => m.score >= threshold);

            if (validMatches.length > 0) {
                results.push({
                    reference,
                    bestMatch: validMatches[0],
                    allMatches: validMatches.slice(0, 5)
                });
            }
        }

        return results;
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.callbacks.clear();
    }
}