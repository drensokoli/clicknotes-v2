// Back/Forward Cache debugging script
// This script helps identify why pages might not be stored in bfcache

(function() {
  'use strict';

  // Check if PerformanceNavigationTiming API is available
  if (typeof PerformanceNavigationTiming !== 'undefined' && 'notRestoredReasons' in PerformanceNavigationTiming.prototype) {
    
    // Log navigation timing and bfcache blocking reasons
    function logBfcacheStatus() {
      const navEntries = performance.getEntriesByType('navigation');
      
      navEntries.forEach((entry) => {
        if (entry instanceof PerformanceNavigationTiming) {
          const notRestoredReasons = entry.notRestoredReasons;
          
          if (notRestoredReasons) {
            console.group('🔍 BFCache Status for:', window.location.href);
            console.log('Restored from BFCache:', !notRestoredReasons.blocked);
            
            if (notRestoredReasons.blocked) {
              console.log('❌ BFCache blocked. Reasons:');
              
              if (notRestoredReasons.reasons) {
                notRestoredReasons.reasons.forEach((reason) => {
                  console.log(`- ${reason}`);
                });
              }
              
              if (notRestoredReasons.children) {
                notRestoredReasons.children.forEach((child) => {
                  console.log(`- Child frame issue: ${child.url}`, child.reasons);
                });
              }
            } else {
              console.log('✅ Page can be stored in BFCache');
            }
            
            console.groupEnd();
          }
        }
      });
    }

    // Log on page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', logBfcacheStatus);
    } else {
      logBfcacheStatus();
    }

    // Also log when navigating back to the page
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        console.log('✅ Page restored from BFCache');
      } else {
        console.log('⚠️ Page not restored from BFCache');
        setTimeout(logBfcacheStatus, 100);
      }
    });

  } else {
    console.log('⚠️ NotRestoredReasons API not available in this browser');
  }

  // Additional checks for common bfcache blockers
  window.addEventListener('load', function() {
    console.group('🔍 BFCache Compatibility Check');
    
    // Check for unload listeners
    const hasUnloadListeners = window.onunload !== null || window.onbeforeunload !== null;
    console.log('Unload listeners:', hasUnloadListeners ? '❌ Present (blocks bfcache)' : '✅ None');
    
    // Check cache-control headers (if available)
    try {
      const cacheControl = document.querySelector('meta[http-equiv="Cache-Control"]');
      if (cacheControl) {
        const content = cacheControl.getAttribute('content');
        console.log('Cache-Control meta tag:', content);
        if (content && content.includes('no-store')) {
          console.log('❌ Cache-Control: no-store detected (blocks bfcache)');
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    console.groupEnd();
  });

})();
