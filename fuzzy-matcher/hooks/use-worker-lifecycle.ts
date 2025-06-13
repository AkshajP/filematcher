// hooks/use-worker-lifecycle.ts - Worker Lifecycle Management Hook

import { useEffect, useRef, useCallback } from 'react';
import { getWorkerManager, terminateAllWorkers } from '@/lib/worker-manager';

interface WorkerLifecycleOptions {
  autoTerminateOnUnmount?: boolean;
  terminateOnVisibilityChange?: boolean;
  maxIdleTime?: number; // ms
}

interface WorkerLifecycleState {
  isInitialized: boolean;
  isTerminating: boolean;
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Hook for managing worker lifecycle with proper cleanup and error handling
 */
export function useWorkerLifecycle(options: WorkerLifecycleOptions = {}) {
  const {
    autoTerminateOnUnmount = true,
    terminateOnVisibilityChange = false,
    maxIdleTime = 300000, // 5 minutes
  } = options;

  const workerManagerRef = useRef(getWorkerManager());
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const isTerminatingRef = useRef<boolean>(false);

  const state = useRef<WorkerLifecycleState>({
    isInitialized: false,
    isTerminating: false,
    hasError: false,
  });

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    if (maxIdleTime > 0) {
      idleTimerRef.current = setTimeout(() => {
        if (Date.now() - lastActivityRef.current >= maxIdleTime) {
          console.log('Workers idle for too long, terminating...');
          terminateWorkers();
        }
      }, maxIdleTime);
    }
  }, [maxIdleTime]);

  // Initialize workers with error handling
  const initializeWorkers = useCallback(async (filePaths: string[]) => {
    try {
      state.current.hasError = false;
      state.current.errorMessage = undefined;
      
      await workerManagerRef.current.initializeSearch(filePaths);
      
      state.current.isInitialized = true;
      updateActivity();
      
      console.log('Workers initialized successfully');
    } catch (error) {
      console.error('Worker initialization failed:', error);
      state.current.hasError = true;
      state.current.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }, [updateActivity]);

  // Terminate workers gracefully
  const terminateWorkers = useCallback(async () => {
    if (isTerminatingRef.current) return;
    
    try {
      isTerminatingRef.current = true;
      state.current.isTerminating = true;
      
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      
      await terminateAllWorkers();
      
      state.current.isInitialized = false;
      state.current.isTerminating = false;
      
      console.log('Workers terminated successfully');
    } catch (error) {
      console.error('Worker termination failed:', error);
      state.current.hasError = true;
      state.current.errorMessage = error instanceof Error ? error.message : 'Termination error';
    } finally {
      isTerminatingRef.current = false;
    }
  }, []);

  // Restart workers (useful for error recovery)
  const restartWorkers = useCallback(async (filePaths: string[]) => {
    await terminateWorkers();
    await initializeWorkers(filePaths);
  }, [terminateWorkers, initializeWorkers]);

  // Get worker status
  const getWorkerStatus = useCallback(() => {
    return {
      ...state.current,
      manager: workerManagerRef.current,
      status: workerManagerRef.current.getStatus(),
    };
  }, []);

  // Performance-aware search function
  const performSearch = useCallback(async (searchTerm: string, usedFilePaths: Set<string>) => {
    updateActivity();
    
    try {
      const startTime = performance.now();
      const results = await workerManagerRef.current.search(searchTerm, usedFilePaths);
      const endTime = performance.now();
      
      // Log performance metrics
      if (process.env.NODE_ENV === 'development') {
        console.log(`Search completed in ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return results;
    } catch (error) {
      console.error('Worker search failed:', error);
      state.current.hasError = true;
      state.current.errorMessage = error instanceof Error ? error.message : 'Search error';
      throw error;
    }
  }, [updateActivity]);

  // Performance-aware auto-match function
  const performAutoMatch = useCallback(async (
    unmatchedReferences: any[],
    availableFilePaths: string[],
    usedFilePaths: Set<string>,
    onProgress?: (data: any) => void
  ) => {
    updateActivity();
    
    try {
      const startTime = performance.now();
      const result = await workerManagerRef.current.generateAutoMatch(
        unmatchedReferences,
        availableFilePaths,
        usedFilePaths,
        onProgress
      );
      const endTime = performance.now();
      
      // Log performance metrics
      if (process.env.NODE_ENV === 'development') {
        console.log(`Auto-match completed in ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      console.error('Worker auto-match failed:', error);
      state.current.hasError = true;
      state.current.errorMessage = error instanceof Error ? error.message : 'Auto-match error';
      throw error;
    }
  }, [updateActivity]);

  // Handle page visibility changes
  useEffect(() => {
    if (!terminateOnVisibilityChange) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden, considering worker termination...');
        // Delay termination to avoid frequent start/stop cycles
        setTimeout(() => {
          if (document.hidden && Date.now() - lastActivityRef.current > 30000) {
            terminateWorkers();
          }
        }, 10000); // 10 second delay
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [terminateOnVisibilityChange, terminateWorkers]);

  // Handle memory pressure (if supported)
  useEffect(() => {
    if (typeof window === 'undefined' || !('memory' in performance)) return;

    const checkMemoryPressure = () => {
      const memory = (performance as any).memory;
      const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usedRatio > 0.85) {
        console.warn('High memory usage detected, considering worker termination...');
        terminateWorkers();
      }
    };

    const memoryCheckInterval = setInterval(checkMemoryPressure, 30000); // Check every 30 seconds
    return () => clearInterval(memoryCheckInterval);
  }, [terminateWorkers]);

  // Handle beforeunload event
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Terminate workers synchronously on page unload
      // Note: This is a best-effort cleanup
      if (state.current.isInitialized) {
        terminateWorkers();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [terminateWorkers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      
      if (autoTerminateOnUnmount) {
        terminateWorkers();
      }
    };
  }, [autoTerminateOnUnmount, terminateWorkers]);

  return {
    // State
    isInitialized: state.current.isInitialized,
    isTerminating: state.current.isTerminating,
    hasError: state.current.hasError,
    errorMessage: state.current.errorMessage,
    
    // Actions
    initializeWorkers,
    terminateWorkers,
    restartWorkers,
    getWorkerStatus,
    performSearch,
    performAutoMatch,
    updateActivity,
  };
}

/**
 * Simplified hook for basic worker lifecycle management
 */
export function useWorkerManager() {
  const {
    initializeWorkers,
    performSearch,
    performAutoMatch,
    getWorkerStatus,
    updateActivity,
  } = useWorkerLifecycle({
    autoTerminateOnUnmount: true,
    terminateOnVisibilityChange: true,
    maxIdleTime: 300000, // 5 minutes
  });

  return {
    initializeWorkers,
    search: performSearch,
    generateAutoMatch: performAutoMatch,
    getStatus: getWorkerStatus,
    markActivity: updateActivity,
  };
}