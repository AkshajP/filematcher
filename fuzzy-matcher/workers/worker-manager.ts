// lib/worker-manager.ts - Production Worker Manager

import { SearchResult, FileReference } from '../lib/types';
import { SearchIndex } from '../lib/fuzzy-matcher'; // Fallback implementation

interface WorkerRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  startTime: number;
}

interface WorkerPoolOptions {
  maxWorkers?: number;
  requestTimeout?: number;
  maxRetries?: number;
  enableFallback?: boolean;
}

/**
 * Robust Worker communicator with timeout handling and fallbacks
 */
class WorkerCommunicator {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<string, WorkerRequest>();
  private retryCount = 0;
  private isTerminated = false;
  
  constructor(
    private workerScript: string,
    private options: WorkerPoolOptions = {}
  ) {
    this.options = {
      requestTimeout: 30000, // 30 seconds
      maxRetries: 3,
      enableFallback: true,
      ...options
    };
    
    this.createWorker();
  }

  private createWorker() {
    if (this.isTerminated) return;
    
    try {
      // Next.js 15.3.3 compatible worker creation
      //this.worker = new Worker(new URL(this.workerScript, import.meta.url));
      this.worker = new Worker(new URL('./search.worker.ts', import.meta.url), {
  type: 'module',
});
      this.worker.onmessage = (e) => {
        const { type, id, data, error } = e.data;
        
        if (type === 'ERROR' && id) {
          const request = this.pendingRequests.get(id);
          if (request) {
            clearTimeout(request.timeout);
            request.reject(new Error(error || 'Worker error'));
            this.pendingRequests.delete(id);
          }
          return;
        }
        
        // Handle progress messages
        if (type.includes('PROGRESS')) {
          // These are handled by specific listeners, not request-response
          return;
        }
        
        const request = this.pendingRequests.get(id);
        if (request) {
          clearTimeout(request.timeout);
          if (error) {
            request.reject(new Error(error));
          } else {
            request.resolve(data);
          }
          this.pendingRequests.delete(id);
        }
      };
      
      this.worker.onerror = (event) => {
        console.error(`Worker error: ${event.message} at ${event.filename}:${event.lineno}`);
        this.handleWorkerError();
      };
      
      this.worker.onmessageerror = () => {
        console.error('Worker message serialization failed');
        this.handleWorkerError();
      };
      
      // Reset retry count on successful creation
      this.retryCount = 0;
      
    } catch (error) {
      console.error('Failed to create worker:', error);
      this.handleWorkerError();
    }
  }
  
  private handleWorkerError() {
    if (this.retryCount < (this.options.maxRetries || 3)) {
      this.retryCount++;
      console.log(`Retrying worker creation (${this.retryCount}/${this.options.maxRetries})`);
      setTimeout(() => this.createWorker(), 1000 * this.retryCount);
    } else if (this.options.enableFallback) {
      console.warn('Max worker retries reached, falling back to main thread');
      this.fallbackToMainThread();
    } else {
      console.error('Worker failed and fallback disabled');
    }
  }
  
  private fallbackToMainThread() {
    // Reject all pending requests with fallback error
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Worker failed, falling back to main thread'));
    });
    this.pendingRequests.clear();
    this.worker = null;
  }

  async request<T>(data: any, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs || this.options.requestTimeout || 30000;
    const id = `req_${++this.messageId}`;
    const startTime = performance.now();
    
    return new Promise<T>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }
      
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Worker request timeout after ${timeout}ms`));
      }, timeout);
      
      this.pendingRequests.set(id, { 
        id, 
        resolve: resolve as any, 
        reject, 
        timeout: timeoutHandle,
        startTime 
      });
      
      try {
        this.worker.postMessage({ id, ...data });
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }
  
  // Subscribe to progress messages
  onProgress(callback: (data: any) => void) {
    if (!this.worker) return;
    
    const originalHandler = this.worker.onmessage;
    this.worker.onmessage = (e) => {
      if (e.data.type && e.data.type.includes('PROGRESS')) {
        callback(e.data);
      } else if (originalHandler) {
        originalHandler(e);
      }
    };
  }
  
  async terminate() {
    this.isTerminated = true;
    
    // Wait for pending operations with timeout
    const pendingPromises = Array.from(this.pendingRequests.values()).map(req => 
      new Promise<void>(resolve => {
        const checkComplete = () => {
          if (!this.pendingRequests.has(req.id)) {
            resolve();
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      })
    );
    
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 5000));
    await Promise.race([Promise.all(pendingPromises), timeout]);
    
    // Force terminate
    this.worker?.terminate();
    this.pendingRequests.clear();
  }
  
  get isWorkerAvailable(): boolean {
    return this.worker !== null && !this.isTerminated;
  }
  
  get pendingRequestCount(): number {
    return this.pendingRequests.size;
  }
}

/**
 * Search Worker Manager with fallback capabilities
 */
export class SearchWorkerManager {
  private workerComm: WorkerCommunicator | null = null;
  private fallbackIndex: SearchIndex | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  
  constructor(private options: WorkerPoolOptions = {}) {
    this.options = {
      enableFallback: true,
      ...options
    };
  }
  
  async initialize(filePaths: string[]): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.doInitialize(filePaths);
    return this.initializationPromise;
  }
  
  private async doInitialize(filePaths: string[]): Promise<void> {
    // Always create fallback index for reliability
    if (this.options.enableFallback !== false) {
      this.fallbackIndex = new SearchIndex(filePaths);
    }
    
    // Skip worker creation during SSR
    if (typeof window === 'undefined') {
      this.isInitialized = true;
      return;
    }
    
    try {
      this.workerComm = new WorkerCommunicator('./search.worker.ts', this.options);
      
      // Initialize worker index
      await this.workerComm.request({
        type: 'INITIALIZE_INDEX',
        data: { filePaths }
      });
      
      console.log(`Search worker initialized with ${filePaths.length} file paths`);
      this.isInitialized = true;
      
    } catch (error) {
      console.warn('Failed to initialize search worker, using fallback:', error);
      this.workerComm = null;
      this.isInitialized = true;
    }
  }
  
  async search(searchTerm: string, usedFilePaths: Set<string>): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('SearchWorkerManager not initialized');
    }
    
    // Try worker first
    if (this.workerComm?.isWorkerAvailable) {
      try {
        const result = await this.workerComm.request<{ results: SearchResult[] }>({
          type: 'SEARCH',
          data: { 
            searchTerm, 
            usedFilePaths: Array.from(usedFilePaths) 
          }
        });
        
        return result.results;
      } catch (error) {
        console.warn('Worker search failed, falling back to main thread:', error);
      }
    }
    
    // Fallback to main thread
    if (this.fallbackIndex) {
      return this.fallbackIndex.search(searchTerm, usedFilePaths);
    }
    
    throw new Error('No search implementation available');
  }
  
  async updateIndex(filePaths: string[]): Promise<void> {
    // Update fallback index
    if (this.fallbackIndex) {
      this.fallbackIndex = new SearchIndex(filePaths);
    }
    
    // Update worker index
    if (this.workerComm?.isWorkerAvailable) {
      try {
        await this.workerComm.request({
          type: 'INITIALIZE_INDEX',
          data: { filePaths }
        });
      } catch (error) {
        console.warn('Failed to update worker index:', error);
      }
    }
  }
  
  async terminate(): Promise<void> {
    await this.workerComm?.terminate();
    this.workerComm = null;
    this.fallbackIndex = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
  
  get isUsingWorker(): boolean {
    return this.workerComm?.isWorkerAvailable ?? false;
  }
}

/**
 * Auto Match Worker Manager
 */
export class AutoMatchWorkerManager {
  private workerComm: WorkerCommunicator | null = null;
  private progressCallback: ((data: any) => void) | null = null;
  
  constructor(private options: WorkerPoolOptions = {}) {}
  
  async generateSuggestions(
    unmatchedReferences: FileReference[],
    availableFilePaths: string[],
    usedFilePaths: Set<string>,
    onProgress?: (data: any) => void
  ): Promise<any> {
    
    // Set up progress callback
    if (onProgress) {
      this.progressCallback = onProgress;
    }
    
    // Skip worker during SSR
    if (typeof window === 'undefined') {
      throw new Error('Auto-match worker not available during SSR');
    }
    
    // Create worker if needed
    if (!this.workerComm) {
      try {
        this.workerComm = new WorkerCommunicator('./auto-match.worker.ts', this.options);
        
        // Set up progress listener
        this.workerComm.onProgress((data) => {
          if (this.progressCallback) {
            this.progressCallback(data);
          }
        });
        
      } catch (error) {
        console.error('Failed to create auto-match worker:', error);
        throw new Error('Auto-match worker creation failed');
      }
    }
    
    try {
      const result = await this.workerComm.request({
        type: 'GENERATE_AUTO_MATCH',
        data: {
          unmatchedReferences,
          availableFilePaths,
          usedFilePaths: Array.from(usedFilePaths)
        }
      }, 60000); // 60 second timeout for large datasets
      
      return result;
      
    } catch (error) {
      console.error('Auto-match generation failed:', error);
      throw error;
    }
  }
  
  async terminate(): Promise<void> {
    await this.workerComm?.terminate();
    this.workerComm = null;
    this.progressCallback = null;
  }
}

/**
 * Main Worker Manager - coordinates all workers
 */
export class WorkerManager {
  private searchManager: SearchWorkerManager;
  private autoMatchManager: AutoMatchWorkerManager;
  
  constructor(options: WorkerPoolOptions = {}) {
    this.searchManager = new SearchWorkerManager(options);
    this.autoMatchManager = new AutoMatchWorkerManager(options);
  }
  
  async initializeSearch(filePaths: string[]): Promise<void> {
    return this.searchManager.initialize(filePaths);
  }
  
  async search(searchTerm: string, usedFilePaths: Set<string>): Promise<SearchResult[]> {
    return this.searchManager.search(searchTerm, usedFilePaths);
  }
  
  async updateSearchIndex(filePaths: string[]): Promise<void> {
    return this.searchManager.updateIndex(filePaths);
  }
  
  async generateAutoMatch(
    unmatchedReferences: FileReference[],
    availableFilePaths: string[],
    usedFilePaths: Set<string>,
    onProgress?: (data: any) => void
  ): Promise<any> {
    return this.autoMatchManager.generateSuggestions(
      unmatchedReferences,
      availableFilePaths,
      usedFilePaths,
      onProgress
    );
  }
  
  async terminate(): Promise<void> {
    await Promise.all([
      this.searchManager.terminate(),
      this.autoMatchManager.terminate()
    ]);
  }
  
  getStatus() {
    return {
      searchWorkerActive: this.searchManager.isUsingWorker,
      pendingRequests: 0 // Could be expanded
    };
  }
}

// Singleton instance for app-wide use
let globalWorkerManager: WorkerManager | null = null;

export function getWorkerManager(): WorkerManager {
  if (!globalWorkerManager) {
    globalWorkerManager = new WorkerManager({
      enableFallback: true,
      requestTimeout: 30000,
      maxRetries: 3
    });
  }
  return globalWorkerManager;
}

// Cleanup function for app termination
export async function terminateAllWorkers(): Promise<void> {
  if (globalWorkerManager) {
    await globalWorkerManager.terminate();
    globalWorkerManager = null;
  }
}