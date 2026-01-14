/**
 * M-Dash Detector Content Script
 * Finds and highlights em-dashes (—) on any webpage
 */

(() => {
  // The em-dash character (U+2014)
  const EM_DASH = "\u2014";

  // Sparkle SVG pattern for highlighting - much easier to read and edit than encoded URL!
  const SPARKLE_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <!-- Larger diamonds -->
      <rect x="10" y="10" width="4.5" height="4.5" transform="rotate(45 12.25 12.25)" fill="#FFD700" opacity="1"/>
      <rect x="30" y="5" width="3" height="3" transform="rotate(45 31.5 6.5)" fill="#FFF" opacity="1"/>
      <rect x="24" y="24" width="4" height="4" transform="rotate(45 26 26)" fill="#FFC107" opacity="1"/>
      <rect x="5" y="32" width="3.5" height="3.5" transform="rotate(45 6.75 33.75)" fill="#FFD700" opacity="1"/>
      <!-- Circles -->
      <circle cx="20" cy="2" r="1.5" fill="#FFF" opacity="1"/>
      <circle cx="36" cy="15" r="2" fill="#FFD700" opacity="1"/>
      <circle cx="15" cy="20" r="1.3" fill="#FFC107" opacity="1"/>
      <circle cx="32" cy="35" r="1.7" fill="#FFF" opacity="1"/>
      <circle cx="2" cy="18" r="1.5" fill="#FFD700" opacity="1"/>
      <circle cx="18" cy="38" r="1.5" fill="#FFC107" opacity="1"/>
    </svg>
  `.trim();

  // Track if SVG has been injected (lazy injection for performance)
  let svgInjected = false;

  /**
   * Injects the SVG as a data URL into a CSS variable on :root
   * Only called when mdashes are actually found (lazy injection)
   */
  function injectSparkleSvg(): void {
    if (svgInjected) return;
    svgInjected = true;
    
    // Encode the SVG for use in CSS url()
    const encoded = encodeURIComponent(SPARKLE_SVG.replace(/\s+/g, " "));
    const dataUrl = `url("data:image/svg+xml,${encoded}")`;
    
    // Set the CSS variable on the document root
    document.documentElement.style.setProperty("--mdash-sparkle-bg", dataUrl);
  }

  // Track how many em-dashes we've found
  let emDashCount = 0;
  let warningBanner: HTMLDivElement | null = null;


  // Cleanup tracking to prevent memory leaks
  let mutationObserver: MutationObserver | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  const originalHistoryPushState = history.pushState.bind(history);
  const originalHistoryReplaceState = history.replaceState.bind(history);
  let historyPatched = false;

  /**
   * Creates a debounced version of a function with cleanup support
   */
  function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T & { cancel: () => void } {
    const debounced = ((...args: unknown[]) => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        debounceTimeout = null;
        fn(...args);
      }, ms);
    }) as T & { cancel: () => void };
    
    debounced.cancel = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
    };
    
    return debounced;
  }

  /**
   * Wraps all em-dashes in a text node with a highlight span
   */
  function highlightTextNode(textNode: Text): void {
    const text = textNode.textContent;
    if (!text?.includes(EM_DASH)) return;

    // Count occurrences in this node
    const matches = text.split(EM_DASH).length - 1;
    emDashCount += matches;

    // Create a document fragment to hold the new nodes
    const fragment = document.createDocumentFragment();
    const parts = text.split(EM_DASH);

    parts.forEach((part, index) => {
      // Add the text part
      if (part) {
        fragment.appendChild(document.createTextNode(part));
      }

      // Add highlighted em-dash between parts (not after the last one)
      if (index < parts.length - 1) {
        const span = document.createElement("span");
        span.className = "mdash-highlight";
        span.textContent = EM_DASH;
        span.title = "Em-dash (—) detected";
        
        // Randomize the animation to prevent synchronization
        const delay = -(Math.random() * 3).toFixed(2); // Negative delay to start immediately at random point
        const offset = Math.floor(Math.random() * 40); // Randomize background shift
        span.style.animationDelay = `${delay}s`;
        span.style.backgroundPositionX = `${offset}px`;

        fragment.appendChild(span);
      }
    });

    // Replace the original text node with our fragment
    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  /**
   * Recursively walks through all text nodes in an element
   */
  function walkTextNodes(element: Element): void {
    // Skip script, style, and our own elements
    const skipTags = [
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "IFRAME",
      "TEXTAREA",
      "INPUT",
    ];
    if (skipTags.includes(element.tagName)) return;

    // Collect text nodes first to avoid modifying while iterating
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip if parent is one of our elements
        const parent = node.parentElement as HTMLElement;
        if (
          parent?.classList?.contains("mdash-highlight") ||
          parent?.classList?.contains("mdash-warning-banner")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip nodes without em-dashes
        if (!node.textContent?.includes(EM_DASH)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push(node);
    }

    // Now process the collected nodes
    textNodes.forEach(highlightTextNode);
  }

  /**
   * Removes the warning banner and cleans up its event listener
   */
  function removeBanner(): void {
    if (warningBanner) {
      warningBanner.remove();
      warningBanner = null;
    }
  }

  /**
   * Creates or updates the warning banner
   */
  function updateWarningBanner(): void {
    if (emDashCount === 0) {
      removeBanner();
      return;
    }

    if (!warningBanner) {
      warningBanner = document.createElement("div");
      warningBanner.className = "mdash-warning-banner";
      warningBanner.innerHTML = `
        <span class="mdash-warning-text">Em Dashes</span>
        <span class="mdash-warning-count">${emDashCount}</span>
      `;

      document.body.appendChild(warningBanner);
    } else {
      // Update count
      const countEl = warningBanner.querySelector(".mdash-warning-count");
      if (countEl) {
        countEl.textContent = String(emDashCount);
      }
    }
  }

  /**
   * Main function to scan the page
   */
  function scanPage(): void {
    emDashCount = 0;
    walkTextNodes(document.body);
    // Only inject SVG if we found any mdashes
    if (emDashCount > 0) {
      injectSparkleSvg();
    }
    updateWarningBanner();
  }

  /**
   * Debounced page rescan for DOM changes
   */
  const debouncedRescan = debounce(scanPage, 100);

  /**
   * Check if a node contains any of our highlight elements
   */
  function containsHighlights(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as Element;
    if (el.classList?.contains("mdash-highlight")) return true;
    return el.querySelector?.(".mdash-highlight") !== null;
  }

  /**
   * Cleans up all observers, listeners, and patched methods
   */
  function cleanup(): void {
    // Cancel pending debounced calls
    debouncedRescan.cancel();

    // Disconnect mutation observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    // Remove event listeners
    window.removeEventListener("popstate", debouncedRescan);
    window.removeEventListener("hashchange", debouncedRescan);

    // Restore original history methods
    if (historyPatched) {
      history.pushState = originalHistoryPushState;
      history.replaceState = originalHistoryReplaceState;
      historyPatched = false;
    }

    // Remove banner
    removeBanner();
  }

  /**
   * Observe DOM changes for dynamically loaded content
   */
  function observeChanges(): void {
    // Clean up any existing observer to prevent duplicates
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      let needsUpdate = false;
      let needsFullRescan = false;

      mutations.forEach((mutation) => {
        // Check for removed nodes that contain our highlights
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            // Skip our own banner
            if (el.classList?.contains("mdash-warning-banner")) return;

            // If removed node contained highlights, we need a full rescan
            if (containsHighlights(node)) {
              needsFullRescan = true;
            }
          }
        });

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            // Skip our own elements
            if (el.classList?.contains("mdash-highlight")) return;
            if (el.classList?.contains("mdash-warning-banner")) return;

            walkTextNodes(el);
            needsUpdate = true;
          } else if (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent?.includes(EM_DASH)
          ) {
            highlightTextNode(node as Text);
            needsUpdate = true;
          }
        });
      });

      if (needsFullRescan) {
        // Full rescan needed due to removed highlights (SPA navigation)
        debouncedRescan();
      } else if (needsUpdate) {
        updateWarningBanner();
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Listen for SPA navigation events
    window.addEventListener("popstate", debouncedRescan);
    window.addEventListener("hashchange", debouncedRescan);

    // Only patch history methods once to prevent stacking
    if (!historyPatched) {
      history.pushState = function (...args) {
        originalHistoryPushState(...args);
        debouncedRescan();
      };

      history.replaceState = function (...args) {
        originalHistoryReplaceState(...args);
        debouncedRescan();
      };
      historyPatched = true;
    }

    // Cleanup on page unload to prevent memory leaks
    window.addEventListener("pagehide", cleanup, { once: true });
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      scanPage();
      observeChanges();
    });
  } else {
    scanPage();
    observeChanges();
  }
})();
