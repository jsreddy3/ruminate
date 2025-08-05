// React DevTools Profiler Helper
// This file contains instructions and utilities for performance profiling

export const PROFILING_INSTRUCTIONS = `
=== PERFORMANCE PROFILING GUIDE ===

1. BROWSER PERFORMANCE MONITOR:
   - Open Chrome DevTools (F12)
   - Go to Performance tab
   - Click record button (red circle)
   - Interact with the PDF viewer (scroll, click blocks, etc)
   - Stop recording
   - Look for:
     * Long tasks (> 50ms)
     * Frequent garbage collection
     * High memory usage
     * FPS drops below 60

2. REACT DEVTOOLS PROFILER:
   - Install React Developer Tools extension
   - Open React DevTools (Components/Profiler tabs)
   - Go to Profiler tab
   - Click record button
   - Interact with PDF viewer
   - Stop recording
   - Look for:
     * Components rendering frequently
     * Components with long render times
     * Unnecessary re-renders

3. MEMORY PROFILER:
   - Chrome DevTools > Memory tab
   - Take heap snapshot before/after interactions
   - Look for memory leaks (growing heap size)
   - Check retained objects

4. CUSTOM PERFORMANCE MONITOR:
   - Open console
   - Type: window.performanceReport()
   - This shows:
     * Component render counts
     * Average render times
     * Memory usage over time

5. COMMON PERFORMANCE ISSUES TO CHECK:
   - Are PDF pages being re-rendered unnecessarily?
   - Are all blocks on a page rendered even when not visible?
   - Is virtualization working (only visible pages rendered)?
   - Are there memory leaks from event listeners?
   - Are large images being loaded multiple times?

6. QUICK CHECKS:
   - Scroll through entire PDF - is it smooth?
   - Click blocks rapidly - any lag?
   - Open/close sidebars - smooth animations?
   - Switch between view modes - fast transitions?
`;

// Helper to detect performance issues
export function checkPerformanceMetrics() {
  if (typeof window === 'undefined') return;

  // Check if browser supports performance API
  if (!('performance' in window)) {
    console.warn('Performance API not supported');
    return;
  }

  // Check memory usage (Chrome only)
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const usedMB = memory.usedJSHeapSize / 1048576;
    const limitMB = memory.jsHeapSizeLimit / 1048576;
    const percentage = (usedMB / limitMB) * 100;

    console.log(`Memory: ${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB (${percentage.toFixed(1)}%)`);
    
    if (percentage > 90) {
      console.warn('⚠️ High memory usage detected!');
    }
  }

  // Check for long tasks
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`, entry);
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task observer not supported
    }
  }

  // Check FPS
  let lastTime = performance.now();
  let frames = 0;
  
  function checkFPS() {
    frames++;
    const currentTime = performance.now();
    
    if (currentTime >= lastTime + 1000) {
      const fps = Math.round((frames * 1000) / (currentTime - lastTime));
      if (fps < 30) {
        console.warn(`⚠️ Low FPS detected: ${fps}`);
      }
      frames = 0;
      lastTime = currentTime;
    }
    
    requestAnimationFrame(checkFPS);
  }
  
  requestAnimationFrame(checkFPS);
}

// Auto-start performance monitoring in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  console.log(PROFILING_INSTRUCTIONS);
  console.log('🔍 Performance monitoring enabled. Use window.performanceReport() for custom metrics.');
  
  // Start basic performance checks
  setTimeout(checkPerformanceMetrics, 1000);
}