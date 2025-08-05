export class PerformanceMonitor {
  private renderCounts: Map<string, number> = new Map();
  private renderTimes: Map<string, number[]> = new Map();
  private memorySnapshots: any[] = [];
  private startTime: number = Date.now();

  logRender(componentName: string, startTime: number) {
    const renderTime = performance.now() - startTime;
    
    // Update render count
    const currentCount = this.renderCounts.get(componentName) || 0;
    this.renderCounts.set(componentName, currentCount + 1);
    
    // Store render time
    const times = this.renderTimes.get(componentName) || [];
    times.push(renderTime);
    this.renderTimes.set(componentName, times);
    
  }

  captureMemorySnapshot() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const snapshot = {
        timestamp: Date.now() - this.startTime,
        usedJSHeapSize: memory.usedJSHeapSize / 1048576, // Convert to MB
        totalJSHeapSize: memory.totalJSHeapSize / 1048576,
        jsHeapSizeLimit: memory.jsHeapSizeLimit / 1048576
      };
      this.memorySnapshots.push(snapshot);
      console.log(`[MEMORY] JS Heap: ${snapshot.usedJSHeapSize.toFixed(2)}MB / ${snapshot.totalJSHeapSize.toFixed(2)}MB`);
    }
  }

  getReport() {
    const report: any = {
      renderCounts: Object.fromEntries(this.renderCounts),
      averageRenderTimes: {},
      memoryUsage: this.memorySnapshots
    };

    // Calculate average render times
    for (const [component, times] of this.renderTimes.entries()) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      report.averageRenderTimes[component] = avg.toFixed(2) + 'ms';
    }

    return report;
  }

  reset() {
    this.renderCounts.clear();
    this.renderTimes.clear();
    this.memorySnapshots = [];
    this.startTime = Date.now();
  }
}

export const globalPerformanceMonitor = new PerformanceMonitor();

// Hook for React components
export function usePerformanceMonitor(componentName: string) {
  return {
    logRender: () => {
      const startTime = performance.now();
      return () => globalPerformanceMonitor.logRender(componentName, startTime);
    }
  };
}

// Start memory monitoring
if (typeof window !== 'undefined') {
  // Capture memory snapshot every 5 seconds
  setInterval(() => {
    globalPerformanceMonitor.captureMemorySnapshot();
  }, 5000);

  // Add global accessor for debugging
  (window as any).performanceReport = () => globalPerformanceMonitor.getReport();
  console.log('[PERF] Performance monitoring enabled. Use window.performanceReport() to see stats.');
}