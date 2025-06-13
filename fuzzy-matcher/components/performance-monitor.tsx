// components/performance-monitor.tsx - Performance Monitor Component

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, Cpu, Clock, Zap, AlertTriangle } from 'lucide-react';

interface PerformanceMetrics {
  searchTime: number;
  workerActive: boolean;
  indexSize: number;
  memoryUsage?: number;
  searchCount: number;
  avgSearchTime: number;
}

interface PerformanceMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
  metrics: PerformanceMetrics;
}

export function PerformanceMonitor({ isVisible, onToggle, metrics }: PerformanceMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentSearchTimes, setRecentSearchTimes] = useState<number[]>([]);
  const lastUpdateRef = useRef<number>(Date.now());

  // Update recent search times
  useEffect(() => {
    if (metrics.searchTime > 0) {
      setRecentSearchTimes(prev => {
        const updated = [...prev, metrics.searchTime].slice(-10); // Keep last 10 searches
        return updated;
      });
    }
  }, [metrics.searchTime]);

  // Performance status
  const getPerformanceStatus = () => {
    if (metrics.avgSearchTime < 50) return { status: 'excellent', color: 'text-green-600', icon: Zap };
    if (metrics.avgSearchTime < 150) return { status: 'good', color: 'text-blue-600', icon: Activity };
    if (metrics.avgSearchTime < 300) return { status: 'fair', color: 'text-yellow-600', icon: Clock };
    return { status: 'slow', color: 'text-red-600', icon: AlertTriangle };
  };

  const performance = getPerformanceStatus();
  const StatusIcon = performance.icon;

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="bg-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <StatusIcon className={`w-4 h-4 mr-2 ${performance.color}`} />
          Performance
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 shadow-xl border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${performance.color}`} />
              Performance Monitor
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? '−' : '+'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-3">
          {/* Core Metrics */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Mode:</span>
                <Badge 
                  variant={metrics.workerActive ? "default" : "secondary"}
                  className={`text-xs px-1 py-0 ${
                    metrics.workerActive ? 'bg-emerald-600' : 'bg-gray-500'
                  }`}
                >
                  {metrics.workerActive ? 'Worker' : 'Main'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Index:</span>
                <span className="font-mono">{metrics.indexSize.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Last:</span>
                <span className={`font-mono ${performance.color}`}>
                  {metrics.searchTime.toFixed(1)}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg:</span>
                <span className={`font-mono ${performance.color}`}>
                  {metrics.avgSearchTime.toFixed(1)}ms
                </span>
              </div>
            </div>
          </div>

          {/* Performance Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Performance</span>
              <span className={`capitalize ${performance.color}`}>
                {performance.status}
              </span>
            </div>
            <Progress 
              value={Math.max(0, 100 - (metrics.avgSearchTime / 5))} 
              className="h-2"
            />
          </div>

          {/* Worker Benefits */}
          {metrics.workerActive && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2">
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <Zap className="w-3 h-3" />
                <span className="font-medium">Worker Benefits Active</span>
              </div>
              <div className="text-xs text-emerald-600 mt-1">
                • Non-blocking search operations<br/>
                • Optimized for large datasets<br/>
                • Improved UI responsiveness
              </div>
            </div>
          )}

          {/* Expanded Metrics */}
          {isExpanded && (
            <div className="space-y-3 pt-2 border-t">
              <div className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">Total Searches:</span>
                  <span className="font-mono">{metrics.searchCount}</span>
                </div>
                
                {metrics.memoryUsage && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Memory:</span>
                    <span className="font-mono">{(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={performance.color}>
                    {metrics.workerActive ? 'Worker Optimized' : 'Standard Mode'}
                  </span>
                </div>
              </div>

              {/* Recent Search Times Chart */}
              {recentSearchTimes.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-gray-600">Recent Search Times (ms)</span>
                  <div className="flex items-end gap-px h-8">
                    {recentSearchTimes.map((time, index) => (
                      <div
                        key={index}
                        className={`bg-emerald-400 min-w-[2px] flex-1 ${
                          time > 200 ? 'bg-red-400' : time > 100 ? 'bg-yellow-400' : 'bg-emerald-400'
                        }`}
                        style={{
                          height: `${Math.min(100, (time / 300) * 100)}%`
                        }}
                        title={`${time.toFixed(1)}ms`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0ms</span>
                    <span>300ms+</span>
                  </div>
                </div>
              )}

              {/* Performance Tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                <div className="text-xs text-blue-700">
                  <div className="font-medium mb-1">Performance Tips:</div>
                  <ul className="text-xs space-y-0.5 text-blue-600">
                    <li>• Use specific search terms</li>
                    <li>• Workers excel with large datasets</li>
                    <li>• Regex patterns may be slower</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Hook for tracking performance metrics
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    searchTime: 0,
    workerActive: false,
    indexSize: 0,
    searchCount: 0,
    avgSearchTime: 0,
  });
  
  const searchTimesRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);

  const startTiming = () => {
    startTimeRef.current = performance.now();
  };

  const endTiming = (workerActive: boolean, indexSize: number) => {
    const searchTime = performance.now() - startTimeRef.current;
    searchTimesRef.current.push(searchTime);
    
    // Keep only last 50 search times for average calculation
    if (searchTimesRef.current.length > 50) {
      searchTimesRef.current = searchTimesRef.current.slice(-50);
    }

    const avgSearchTime = searchTimesRef.current.reduce((a, b) => a + b, 0) / searchTimesRef.current.length;

    setMetrics(prev => ({
      searchTime,
      workerActive,
      indexSize,
      searchCount: prev.searchCount + 1,
      avgSearchTime,
      memoryUsage: (performance as any).memory?.usedJSHeapSize,
    }));
  };

  const updateIndexSize = (size: number) => {
    setMetrics(prev => ({
      ...prev,
      indexSize: size
    }));
  };

  const updateWorkerStatus = (active: boolean) => {
    setMetrics(prev => ({
      ...prev,
      workerActive: active
    }));
  };

  return {
    metrics,
    startTiming,
    endTiming,
    updateIndexSize,
    updateWorkerStatus,
  };
}