// cache-manager.js - IndexedDB Caching Implementation
class CacheManager {
    constructor() {
        this.dbName = 'AEFMCache';
        this.version = 1;
        this.db = null;
        this.init();
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('mappings')) {
                    const mappingStore = db.createObjectStore('mappings', { 
                        keyPath: 'id' 
                    });
                    mappingStore.createIndex('reference', 'reference', { unique: false });
                    mappingStore.createIndex('timestamp', 'timestamp', { unique: false });
                    mappingStore.createIndex('sessionId', 'sessionId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { 
                        keyPath: 'id' 
                    });
                    sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('patterns')) {
                    db.createObjectStore('patterns', { keyPath: 'pattern' });
                }
                
                if (!db.objectStoreNames.contains('trainingData')) {
                    const trainingStore = db.createObjectStore('trainingData', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    trainingStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                console.log('IndexedDB stores created successfully');
            };
        });
    }
    
    // Mapping operations
    async saveMappings(mappings) {
        if (!this.db) return;
        
        const tx = this.db.transaction(['mappings'], 'readwrite');
        const store = tx.objectStore('mappings');
        
        // Clear existing mappings for this session
        const sessionId = window.sessionId;
        if (sessionId) {
            const index = store.index('sessionId');
            const range = IDBKeyRange.only(sessionId);
            const request = index.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };
        }
        
        // Add new mappings
        for (const mapping of mappings) {
            const mappingWithId = {
                ...mapping,
                id: `${mapping.reference}-${mapping.path}`,
                sessionId: window.sessionId
            };
            
            try {
                await store.put(mappingWithId);
            } catch (error) {
                console.error('Error saving mapping:', error);
            }
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    
    async loadMappings(sessionId) {
        if (!this.db) return [];
        
        const tx = this.db.transaction(['mappings'], 'readonly');
        const store = tx.objectStore('mappings');
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Session operations
    async saveSession(sessionData) {
        if (!this.db) return;
        
        const tx = this.db.transaction(['sessions'], 'readwrite');
        const store = tx.objectStore('sessions');
        
        const session = {
            id: sessionData.id || window.sessionId,
            timestamp: new Date().toISOString(),
            data: {
                unmatchedReferences: sessionData.unmatchedReferences || window.unmatchedReferences,
                matchedPairs: sessionData.matchedPairs || window.matchedPairs,
                usedFilePaths: sessionData.usedFilePaths || Array.from(window.usedFilePaths),
                selectedReferences: sessionData.selectedReferences || Array.from(window.selectedReferences),
                fileReferences: window.fileReferences,
                filePaths: window.filePaths
            }
        };
        
        await store.put(session);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                console.log('Session saved successfully');
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }
    
    async loadSession(sessionId) {
        if (!this.db) return null;
        
        const tx = this.db.transaction(['sessions'], 'readonly');
        const store = tx.objectStore('sessions');
        const request = store.get(sessionId);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getRecentSessions(limit = 10) {
        if (!this.db) return [];
        
        const tx = this.db.transaction(['sessions'], 'readonly');
        const store = tx.objectStore('sessions');
        const index = store.index('timestamp');
        
        const sessions = [];
        const request = index.openCursor(null, 'prev'); // Reverse order
        
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && sessions.length < limit) {
                    sessions.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(sessions);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // Pattern operations
    async savePattern(pattern, matches) {
        if (!this.db) return;
        
        const tx = this.db.transaction(['patterns'], 'readwrite');
        const store = tx.objectStore('patterns');
        
        await store.put({
            pattern,
            matches,
            count: matches.length,
            lastUsed: new Date().toISOString()
        });
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    
    async getPattern(pattern) {
        if (!this.db) return null;
        
        const tx = this.db.transaction(['patterns'], 'readonly');
        const store = tx.objectStore('patterns');
        const request = store.get(pattern);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getAllPatterns() {
        if (!this.db) return [];
        
        const tx = this.db.transaction(['patterns'], 'readonly');
        const store = tx.objectStore('patterns');
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Training data operations
    async saveTrainingData(trainingData) {
        if (!this.db) return;
        
        const tx = this.db.transaction(['trainingData'], 'readwrite');
        const store = tx.objectStore('trainingData');
        
        // Save each training sample
        for (const sample of trainingData) {
            const dataWithTimestamp = {
                ...sample,
                timestamp: sample.timestamp || new Date().toISOString()
            };
            
            try {
                await store.add(dataWithTimestamp);
            } catch (error) {
                // If already exists, update it
                if (error.name === 'ConstraintError') {
                    await store.put(dataWithTimestamp);
                }
            }
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    
    async getTrainingData(limit = 1000) {
        if (!this.db) return [];
        
        const tx = this.db.transaction(['trainingData'], 'readonly');
        const store = tx.objectStore('trainingData');
        const index = store.index('timestamp');
        
        const data = [];
        const request = index.openCursor(null, 'prev'); // Most recent first
        
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && data.length < limit) {
                    data.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(data);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // Cleanup operations
    async cleanup(daysOld = 30) {
        if (!this.db) return;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const cutoffTimestamp = cutoffDate.toISOString();
        
        const stores = ['sessions', 'mappings', 'trainingData'];
        const tx = this.db.transaction(stores, 'readwrite');
        
        let deletedCount = 0;
        
        for (const storeName of stores) {
            const store = tx.objectStore(storeName);
            const index = store.index('timestamp');
            const range = IDBKeyRange.upperBound(cutoffTimestamp);
            const request = index.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    deletedCount++;
                    cursor.continue();
                }
            };
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                console.log(`Cleanup completed: ${deletedCount} old records removed`);
                resolve(deletedCount);
            };
            tx.onerror = () => reject(tx.error);
        });
    }
    
    // Storage info
    async getStorageInfo() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return { usage: 0, quota: 0 };
        }
        
        try {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0,
                usagePercent: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return { usage: 0, quota: 0 };
        }
    }
    
    // Clear all data
    async clearAll() {
        if (!this.db) return;
        
        const stores = ['mappings', 'sessions', 'patterns', 'trainingData'];
        const tx = this.db.transaction(stores, 'readwrite');
        
        for (const storeName of stores) {
            tx.objectStore(storeName).clear();
        }
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => {
                console.log('All cache data cleared');
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }
}