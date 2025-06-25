// workers/worker-manager.ts - Debug Enhanced Worker Manager

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
 * Debug-enhanced Worker communicator
 */
class WorkerCommunicator {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<string, WorkerRequest>();
  private retryCount = 0;
  private isTerminated = false;
  private progressCallback: ((data: any) => void) | null = null;
  private workerName: string;
  
  constructor(
    private workerScript: string,
    private options: WorkerPoolOptions = {}
  ) {
    this.workerName = workerScript.replace('./', '').replace('.ts', '');
    this.options = {
      requestTimeout: 30000,
      maxRetries: 3,
      enableFallback: true,
      ...options
    };
    
    console.log(`🔧 [${this.workerName}] Initializing WorkerCommunicator`);
    this.createWorker();
  }

  private createWorker() {
    if (this.isTerminated) {
      console.log(`❌ [${this.workerName}] Cannot create worker - already terminated`);
      return;
    }
    
    try {
      console.log(`🚀 [${this.workerName}] Creating worker from script: ${this.workerScript}`);
      
      // Static worker creation based on script name
      if (this.workerScript === './search.worker.ts') {
        console.log(`✅ [${this.workerName}] Creating search worker`);
        this.worker = new Worker(new URL('./search.worker.ts', import.meta.url));
      } else if (this.workerScript === './auto-match.worker.ts') {
        console.log(`✅ [${this.workerName}] Creating auto-match worker`);
        this.worker = new Worker(new URL('./auto-match.worker.ts', import.meta.url));
      } else {
        throw new Error(`Unknown worker script: ${this.workerScript}`);
      }

      console.log(`✅ [${this.workerName}] Worker created successfully`);
      
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
      this.worker.onmessageerror = this.handleMessageError.bind(this);
      
      console.log(`📡 [${this.workerName}] Event handlers attached`);
      
    } catch (error) {
      console.error(`❌ [${this.workerName}] Failed to create worker:`, error);
      this.worker = null;
    }
  }

  private handleMessage(event: MessageEvent) {
    console.log(`📨 [${this.workerName}] RAW message received:`, {
      eventType: typeof event,
      hasData: !!event.data,
      dataType: typeof event.data,
      rawDataKeys: event.data ? Object.keys(event.data) : null,
      rawData: event.data
    });
    
    console.log(`📨 [${this.workerName}] Received message:`, {
      type: event.data?.type,
      id: event.data?.id,
      hasData: !!event.data?.data,
      hasError: !!event.data?.error,
      fullData: event.data
    });
    
    const { type, id, data, error } = event.data;
    
    // Handle progress messages
    if (type === 'AUTO_MATCH_PROGRESS' && this.progressCallback) {
      console.log(`📈 [${this.workerName}] Progress update:`, data);
      this.progressCallback(data);
      return;
    }
    
    if (!id) {
      console.warn(`⚠️ [${this.workerName}] Message without ID:`, event.data);
      return;
    }
    
    const request = this.pendingRequests.get(id);
    if (!request) {
      console.warn(`⚠️ [${this.workerName}] No pending request for ID:`, id);
      return;
    }
    
    console.log(`🎯 [${this.workerName}] Processing response for request ${id}`);
    console.log(`🎯 [${this.workerName}] Response data analysis:`, {
      hasData: !!data,
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : null,
      dataSize: data ? JSON.stringify(data).length : 0,
      dataSample: data ? JSON.stringify(data).slice(0, 200) + '...' : null
    });
    
    clearTimeout(request.timeout);
    this.pendingRequests.delete(id);
    
    if (error) {
      console.error(`❌ [${this.workerName}] Worker returned error:`, error);
      request.reject(new Error(error));
    } else {
      console.log(`✅ [${this.workerName}] Worker returned data:`, {
        dataType: typeof data,
        isArray: Array.isArray(data),
        hasKeys: data && typeof data === 'object' ? Object.keys(data) : null,
        dataPreview: data
      });
      request.resolve(data);
    }
  }

  private handleError(error: ErrorEvent) {
    console.error(`💥 [${this.workerName}] Worker error:`, {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      error: error.error
    });
    
    // Reject all pending requests
    this.pendingRequests.forEach((request, id) => {
      console.log(`❌ [${this.workerName}] Rejecting pending request ${id} due to worker error`);
      clearTimeout(request.timeout);
      request.reject(new Error(`Worker error: ${error.message}`));
    });
    this.pendingRequests.clear();
  }

  private handleMessageError(error: MessageEvent) {
    console.error(`📬 [${this.workerName}] Message error:`, error);
  }

  async request<T = any>(message: any, timeoutMs?: number): Promise<T> {
    if (!this.worker) {
      const errorMsg = `Worker ${this.workerScript} not available`;
      console.error(`❌ [${this.workerName}] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const timeout = timeoutMs || this.options.requestTimeout!;
    console.log(`📤 [${this.workerName}] Sending request with ${timeout}ms timeout:`, {
      messageType: message.type,
      dataKeys: message.data ? Object.keys(message.data) : null,
      messagePreview: message
    });

    return new Promise((resolve, reject) => {
      const id = `req-${++this.messageId}`;
      const timeoutHandle = setTimeout(() => {
        console.error(`⏰ [${this.workerName}] Request ${id} timed out after ${timeout}ms`);
        this.pendingRequests.delete(id);
        reject(new Error(`Worker request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        id,
        resolve,
        reject,
        timeout: timeoutHandle,
        startTime: performance.now()
      });

      const fullMessage = { ...message, id };
      console.log(`📮 [${this.workerName}] Posting message ${id}:`, fullMessage);
      
      try {
        this.worker!.postMessage(fullMessage);
        console.log(`✅ [${this.workerName}] Message ${id} posted successfully`);
      } catch (error) {
        console.error(`❌ [${this.workerName}] Failed to post message ${id}:`, error);
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  onProgress(callback: (data: any) => void) {
    console.log(`📈 [${this.workerName}] Progress callback registered`);
    this.progressCallback = callback;
  }

  async terminate(): Promise<void> {
    console.log(`🛑 [${this.workerName}] Terminating worker`);
    this.isTerminated = true;
    
    // Reject all pending requests
    this.pendingRequests.forEach((request, id) => {
      console.log(`❌ [${this.workerName}] Rejecting pending request ${id} due to termination`);
      clearTimeout(request.timeout);
      request.reject(new Error('Worker terminated'));
    });
    this.pendingRequests.clear();
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      console.log(`✅ [${this.workerName}] Worker terminated`);
    }
  }

  get isWorkerAvailable(): boolean {
    const available = this.worker !== null && !this.isTerminated;
    console.log(`🔍 [${this.workerName}] Worker available check: ${available}`);
    return available;
  }
}

/**
 * Search Worker Manager with Debug Logging
 */
export class SearchWorkerManager {
  private workerComm: WorkerCommunicator | null = null;
  private fallbackIndex: SearchIndex | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  
  constructor(private options: WorkerPoolOptions = {}) {
    console.log('🔍 SearchWorkerManager created with options:', options);
    this.options = {
      enableFallback: true,
      ...options
    };
  }
  
  async initialize(filePaths: string[]): Promise<void> {
    console.log(`🔍 SearchWorkerManager.initialize called with ${filePaths.length} file paths`);
    
    if (this.initializationPromise) {
      console.log('🔍 SearchWorkerManager initialization already in progress, waiting...');
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.doInitialize(filePaths);
    return this.initializationPromise;
  }
  
  private async doInitialize(filePaths: string[]): Promise<void> {
    console.log('🔍 SearchWorkerManager starting initialization...');
    
    // Always create fallback index
    console.log('🔍 Creating fallback SearchIndex...');
    this.fallbackIndex = new SearchIndex(filePaths);
    console.log('✅ Fallback SearchIndex created');
    
    // Try to initialize worker
    try {
      if (typeof window !== 'undefined') {
        console.log('🔍 Creating search worker communicator...');
        this.workerComm = new WorkerCommunicator('./search.worker.ts', this.options);
        
        console.log('🔍 Initializing search worker index...');
        await this.workerComm.request({
          type: 'INITIALIZE_INDEX',
          data: { filePaths }
        });
        
        console.log('✅ Search worker initialized successfully');
      } else {
        console.log('🔍 SSR detected, skipping worker initialization');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize search worker, using fallback:', error);
      this.workerComm = null;
    }
    
    this.isInitialized = true;
    console.log('✅ SearchWorkerManager initialization complete');
  }
  
  async search(searchTerm: string, usedFilePaths: Set<string>): Promise<SearchResult[]> {
    console.log(`🔍 SearchWorkerManager.search called with term: "${searchTerm}", ${usedFilePaths.size} used paths`);
    
    if (!this.isInitialized) {
      throw new Error('SearchWorkerManager not initialized');
    }
    
    // Try worker first
    if (this.workerComm?.isWorkerAvailable) {
      try {
        console.log('🔍 Using search worker');
        const result = await this.workerComm.request<{ results: SearchResult[] }>({
          type: 'SEARCH',
          data: { 
            searchTerm, 
            usedFilePaths: Array.from(usedFilePaths) 
          }
        });
        
        console.log(`✅ Search worker returned ${result.results?.length || 0} results`);
        return result.results || [];
      } catch (error) {
        console.warn('⚠️ Worker search failed, falling back to main thread:', error);
      }
    }
    
    // Fallback to main thread
    if (this.fallbackIndex) {
      console.log('🔍 Using fallback search index');
      const results = this.fallbackIndex.search(searchTerm, usedFilePaths);
      console.log(`✅ Fallback search returned ${results.length} results`);
      return results;
    }
    
    throw new Error('No search implementation available');
  }
  
  async updateIndex(filePaths: string[]): Promise<void> {
    console.log(`🔍 SearchWorkerManager.updateIndex called with ${filePaths.length} paths`);
    
    // Update fallback index
    if (this.fallbackIndex) {
      console.log('🔍 Updating fallback index...');
      this.fallbackIndex = new SearchIndex(filePaths);
      console.log('✅ Fallback index updated');
    }
    
    // Update worker index
    if (this.workerComm?.isWorkerAvailable) {
      try {
        console.log('🔍 Updating worker index...');
        await this.workerComm.request({
          type: 'INITIALIZE_INDEX',
          data: { filePaths }
        });
        console.log('✅ Worker index updated');
      } catch (error) {
        console.warn('⚠️ Failed to update worker index:', error);
      }
    }
  }
  
  async terminate(): Promise<void> {
    console.log('🔍 SearchWorkerManager terminating...');
    await this.workerComm?.terminate();
    this.workerComm = null;
    this.fallbackIndex = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    console.log('✅ SearchWorkerManager terminated');
  }
  
  get isUsingWorker(): boolean {
    return this.workerComm?.isWorkerAvailable ?? false;
  }
}

/**
 * Auto Match Worker Manager with Enhanced Debug Logging
 */
export class AutoMatchWorkerManager {
  private workerComm: WorkerCommunicator | null = null;
  private progressCallback: ((data: any) => void) | null = null;
  
  constructor(private options: WorkerPoolOptions = {}) {
    console.log('🤖 AutoMatchWorkerManager created with options:', options);
    this.options = {
      enableFallback: true,
      ...options
    };
  }
  
  async generateSuggestions(
    unmatchedReferences: FileReference[],
    availableFilePaths: string[],
    usedFilePaths: Set<string>,
    onProgress?: (data: any) => void
  ): Promise<any> {
    
    console.log('🤖 AutoMatchWorkerManager.generateSuggestions called with:', {
      unmatchedReferencesCount: unmatchedReferences?.length || 0,
      availableFilePathsCount: availableFilePaths?.length || 0,
      usedFilePathsCount: usedFilePaths?.size || 0,
      hasProgressCallback: !!onProgress
    });
    
    // Validate inputs
    if (!Array.isArray(unmatchedReferences)) {
      console.error('❌ unmatchedReferences is not an array:', typeof unmatchedReferences);
      throw new Error('unmatchedReferences must be an array');
    }
    
    if (!Array.isArray(availableFilePaths)) {
      console.error('❌ availableFilePaths is not an array:', typeof availableFilePaths);
      throw new Error('availableFilePaths must be an array');
    }
    
    console.log('✅ Input validation passed');
    
    // Set up progress callback
    if (onProgress) {
      console.log('📈 Setting up progress callback');
      this.progressCallback = onProgress;
    }
    
    // Skip worker during SSR
    if (typeof window === 'undefined') {
      console.log('🤖 SSR detected, using main thread fallback');
      return this.generateSuggestionsMainThread(
        unmatchedReferences,
        availableFilePaths,
        usedFilePaths,
        onProgress
      );
    }
    
    // Try worker first
    if (!this.workerComm) {
      try {
        console.log('🤖 Creating auto-match worker communicator...');
        this.workerComm = new WorkerCommunicator('./auto-match.worker.ts', this.options);
        
        // Set up progress listener
        this.workerComm.onProgress((data) => {
          console.log('📈 Auto-match progress received:', data);
          if (this.progressCallback) {
            this.progressCallback(data);
          }
        });
        
        console.log('✅ Auto-match worker communicator created');
        
      } catch (error) {
        console.error('❌ Failed to create auto-match worker:', error);
        // Don't throw here, fall back to main thread below
      }
    }
    
    // Try worker if available
    if (this.workerComm?.isWorkerAvailable) {
      try {
        console.log('🤖 Attempting to use auto-match worker...');
        
        const requestData = {
          unmatchedReferences,
          availableFilePaths,
          usedFilePaths: Array.from(usedFilePaths)
        };
        
        console.log('🤖 Sending request to worker:', {
          type: 'GENERATE_AUTO_MATCH',
          dataKeys: Object.keys(requestData),
          unmatchedCount: requestData.unmatchedReferences.length,
          pathsCount: requestData.availableFilePaths.length,
          usedCount: requestData.usedFilePaths.length
        });
        
        const result = await this.workerComm.request({
          type: 'GENERATE_AUTO_MATCH',
          data: requestData
        }, 60000); // 60 second timeout for large datasets
        
        console.log(`🤖 Worker returned result:`, {
          resultType: typeof result,
          hasResult: !!result,
          resultKeys: result && typeof result === 'object' ? Object.keys(result) : null,
          suggestionsType: typeof result?.suggestions,
          suggestionsIsArray: Array.isArray(result?.suggestions),
          suggestionsLength: result?.suggestions?.length,
          fullResultStringified: JSON.stringify(result).slice(0, 500) + '...',
          fullResult: result
        });
        
        // Enhanced validation with detailed logging
        if (!result || typeof result !== 'object') {
          console.error('❌ Worker returned invalid result structure:', result);
          throw new Error('Worker returned invalid result structure');
        }
        
        if (!Array.isArray(result.suggestions)) {
          console.error('❌ Worker returned invalid suggestions array:', {
            suggestionsType: typeof result.suggestions,
            suggestionsValue: result.suggestions,
            fullResult: result
          });
          console.warn('🤖 Worker returned invalid suggestions array, falling back');
          throw new Error('Invalid suggestions array from worker');
        }
        
        console.log('✅ Worker result validation passed');
        console.log(`🤖 Auto-match worker completed successfully with ${result.suggestions.length} suggestions`);
        return result;
        
      } catch (error) {
        console.warn('⚠️ Worker auto-match failed, falling back to main thread:', error);
      }
    } else {
      console.log('🤖 Worker not available, proceeding to fallback');
    }
    
    // Fallback to main thread implementation
    if (this.options.enableFallback !== false) {
      console.log('🤖 Using main thread fallback for auto-match');
      return this.generateSuggestionsMainThread(
        unmatchedReferences,
        availableFilePaths,
        usedFilePaths,
        onProgress
      );
    }
    
    throw new Error('Auto-match worker unavailable and fallback disabled');
  }
  
  /**
   * Main thread fallback implementation with debug logging
   */
  private generateSuggestionsMainThread(
    unmatchedReferences: FileReference[],
    availableFilePaths: string[],
    usedFilePaths: Set<string>,
    onProgress?: (data: any) => void
  ): any {
    console.log('🧵 Auto-match running on main thread');
    
    try {
      // Filter available paths
      const filteredPaths = availableFilePaths.filter(path => !usedFilePaths.has(path));
      console.log(`🧵 Filtered paths: ${filteredPaths.length}/${availableFilePaths.length} available`);
      
      const suggestions = unmatchedReferences.map((reference, index) => {
        // Send progress updates
        if (onProgress && index % 10 === 0) {
          const progressData = {
            type: 'AUTO_MATCH_PROGRESS',
            progress: (index / unmatchedReferences.length) * 100,
            currentReference: reference.description
          };
          console.log(`📈 Main thread progress: ${progressData.progress.toFixed(1)}%`);
          onProgress(progressData);
        }
        
        let bestMatch = '';
        let bestScore = 0;
        
        // Simple similarity matching
        for (const filePath of filteredPaths) {
          const score = this.calculateSimpleSimilarity(reference.description, filePath);
          if (score > bestScore && score > 0.3) {
            bestScore = score;
            bestMatch = filePath;
          }
        }
        
        return {
          reference,
          suggestedPath: bestMatch,
          score: bestScore,
          isSelected: bestScore > 0.7,
          isAccepted: false,
          isRejected: false
        };
      });
      
      // Send final progress
      if (onProgress) {
        console.log('📈 Main thread progress: 100% (Complete)');
        onProgress({
          type: 'AUTO_MATCH_PROGRESS',
          progress: 100,
          currentReference: 'Complete'
        });
      }
      
      // Filter out suggestions without matches
      const withSuggestions = suggestions.filter(s => s.suggestedPath);
      console.log(`🧵 Main thread generated ${withSuggestions.length}/${suggestions.length} suggestions with matches`);
      
      // Calculate confidence levels
      const highConfidence = withSuggestions.filter(s => s.score > 0.7).length;
      const mediumConfidence = withSuggestions.filter(s => s.score >= 0.4 && s.score <= 0.7).length;
      const lowConfidence = withSuggestions.filter(s => s.score > 0 && s.score < 0.4).length;
      
      const result = {
        suggestions,
        totalReferences: unmatchedReferences.length,
        suggestionsWithHighConfidence: highConfidence,
        suggestionsWithMediumConfidence: mediumConfidence,
        suggestionsWithLowConfidence: lowConfidence
      };
      
      console.log('✅ Main thread auto-match completed:', {
        totalSuggestions: result.suggestions.length,
        withMatches: withSuggestions.length,
        highConfidence,
        mediumConfidence,
        lowConfidence
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Main thread auto-match failed:', error);
      
      // Return empty but valid result structure
      return {
        suggestions: [],
        totalReferences: unmatchedReferences.length,
        suggestionsWithHighConfidence: 0,
        suggestionsWithMediumConfidence: 0,
        suggestionsWithLowConfidence: 0
      };
    }
  }
  
  /**
   * Simple similarity calculation for main thread fallback
   */
  private calculateSimpleSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const str1 = text1.toLowerCase();
    const str2 = text2.toLowerCase();
    
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.9;
    
    // Simple word matching
    const words1 = str1.split(/[\s\/\-_\.]+/).filter(w => w.length > 2);
    const words2 = str2.split(/[\s\/\-_\.]+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    let matches = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          matches++;
          break;
        }
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  }
  
  async terminate(): Promise<void> {
    console.log('🤖 AutoMatchWorkerManager terminating...');
    await this.workerComm?.terminate();
    this.workerComm = null;
    this.progressCallback = null;
    console.log('✅ AutoMatchWorkerManager terminated');
  }
}

/**
 * Main Worker Manager with Debug Logging
 */
export class WorkerManager {
  private searchManager: SearchWorkerManager;
  private autoMatchManager: AutoMatchWorkerManager;
  
  constructor(options: WorkerPoolOptions = {}) {
    console.log('🏭 WorkerManager created with options:', options);
    this.searchManager = new SearchWorkerManager(options);
    this.autoMatchManager = new AutoMatchWorkerManager(options);
  }
  
  async initializeSearch(filePaths: string[]): Promise<void> {
    console.log(`🏭 WorkerManager.initializeSearch called with ${filePaths.length} paths`);
    return this.searchManager.initialize(filePaths);
  }
  
  async search(searchTerm: string, usedFilePaths: Set<string>): Promise<SearchResult[]> {
    console.log(`🏭 WorkerManager.search called: "${searchTerm}"`);
    return this.searchManager.search(searchTerm, usedFilePaths);
  }
  
  async updateSearchIndex(filePaths: string[]): Promise<void> {
    console.log(`🏭 WorkerManager.updateSearchIndex called with ${filePaths.length} paths`);
    return this.searchManager.updateIndex(filePaths);
  }
  
  async generateAutoMatch(
    unmatchedReferences: FileReference[],
    availableFilePaths: string[],
    usedFilePaths: Set<string>,
    onProgress?: (data: any) => void
  ): Promise<any> {
    console.log('🏭 WorkerManager.generateAutoMatch called');
    return this.autoMatchManager.generateSuggestions(
      unmatchedReferences, 
      availableFilePaths, 
      usedFilePaths, 
      onProgress
    );
  }
  
  async terminate(): Promise<void> {
    console.log('🏭 WorkerManager terminating all workers...');
    await Promise.all([
      this.searchManager.terminate(),
      this.autoMatchManager.terminate()
    ]);
    console.log('✅ WorkerManager terminated all workers');
  }
  
  getStatus() {
    const status = {
      search: {
        isInitialized: this.searchManager['isInitialized'],
        isUsingWorker: this.searchManager.isUsingWorker,
      },
      autoMatch: {
        isActive: this.autoMatchManager['workerComm']?.isWorkerAvailable ?? false,
      }
    };
    console.log('🏭 WorkerManager status:', status);
    return status;
  }
}

// Singleton instance
let workerManagerInstance: WorkerManager | null = null;

export function getWorkerManager(): WorkerManager {
  if (!workerManagerInstance) {
    console.log('🏭 Creating new WorkerManager singleton instance');
    workerManagerInstance = new WorkerManager();
  } else {
    console.log('🏭 Returning existing WorkerManager singleton instance');
  }
  return workerManagerInstance;
}

export async function terminateAllWorkers(): Promise<void> {
  if (workerManagerInstance) {
    console.log('🏭 Terminating WorkerManager singleton');
    await workerManagerInstance.terminate();
    workerManagerInstance = null;
  } else {
    console.log('🏭 No WorkerManager instance to terminate');
  }
}