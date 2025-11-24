/**
 * Utility to scroll to and highlight an element based on URL query parameters
 */

export function scrollToHighlightedSection() {
  const params = new URLSearchParams(window.location.search);
  const highlightId = params.get('highlight');
  
  if (!highlightId) return;
  
  // Map highlight IDs to element selectors or data attributes
  const selectorMap: Record<string, string> = {
    'profile': '[data-onboarding-target="profile"]',
    'booking': '[data-onboarding-target="booking"]',
    'organization': '[data-onboarding-target="organization"]',
    'job': '[data-onboarding-target="job"]',
    'candidate': '[data-onboarding-target="candidate"]',
    'team': '[data-onboarding-target="team"]'
  };
  
  const selector = selectorMap[highlightId];
  if (!selector) return;
  
  // Wait for DOM to be ready, then scroll and highlight
  setTimeout(() => {
    const element = document.querySelector(selector);
    if (!element) return;
    
    // Scroll into view with smooth behavior
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    // Add highlight animation
    element.classList.add('onboarding-highlight');
    
    // Remove highlight after animation completes
    setTimeout(() => {
      element.classList.remove('onboarding-highlight');
      
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('highlight');
      window.history.replaceState({}, '', url.toString());
    }, 3000);
  }, 300); // Small delay to ensure page has rendered
}

/**
 * CSS classes to add to index.css:
 * 
 * .onboarding-highlight {
 *   animation: highlight-pulse 3s ease-in-out;
 *   position: relative;
 * }
 * 
 * @keyframes highlight-pulse {
 *   0%, 100% {
 *     box-shadow: 0 0 0 0 hsl(var(--virgilio-purple) / 0);
 *   }
 *   10%, 30%, 50% {
 *     box-shadow: 0 0 0 8px hsl(var(--virgilio-purple) / 0.2),
 *                 0 0 0 12px hsl(var(--virgilio-purple) / 0.1);
 *   }
 *   20%, 40%, 60% {
 *     box-shadow: 0 0 0 4px hsl(var(--virgilio-purple) / 0.3),
 *                 0 0 0 8px hsl(var(--virgilio-purple) / 0.15);
 *   }
 * }
 */
