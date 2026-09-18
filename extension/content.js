// Content Script: Automatically detects JSON pages and renders Lattice Studio

(function() {
  'use strict';

  // Do not run inside the extension's own pages or existing iframes
  if (window.top !== window.self) return;
  if (location.protocol === 'chrome-extension:') return;

  let viewerInjected = false;
  let rawJsonCache = null;

  function isJsonPage() {
    const ct = (document.contentType || '').toLowerCase();
    if (ct.includes('application/json') || ct.includes('text/json') || ct.includes('application/ld+json') || ct.includes('application/problem+json')) {
      return true;
    }

    const path = location.pathname.toLowerCase();
    const isJsonExt = path.endsWith('.json') || path.endsWith('.jsonld');

    const body = document.body;
    if (!body) return false;

    // Chromium default json display: <body><pre>...</pre></body>
    const firstChild = body.firstElementChild;
    if (body.children.length === 1 && firstChild && firstChild.tagName === 'PRE') {
      const text = firstChild.textContent.trim();
      if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try {
          JSON.parse(text);
          return true;
        } catch (e) {
          return false;
        }
      }
    }

    // Direct plain text
    if (body.children.length === 0 && body.textContent) {
      const text = body.textContent.trim();
      if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try {
          JSON.parse(text);
          return true;
        } catch (e) {
          return false;
        }
      }
    }

    if (isJsonExt) {
      const text = (body.innerText || body.textContent || '').trim();
      try {
        JSON.parse(text);
        return true;
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  function getRawJsonText() {
    const pre = document.querySelector('body > pre');
    if (pre) return pre.textContent.trim();
    return (document.body ? (document.body.innerText || document.body.textContent || '') : '').trim();
  }

  function injectFullPageViewer(jsonText) {
    if (viewerInjected || document.getElementById('lattice-extension-frame')) return;
    viewerInjected = true;
    rawJsonCache = jsonText;

    // 1. Hide original unstyled browser text
    let hideStyle = document.getElementById('lattice-hide-raw-style');
    if (!hideStyle) {
      hideStyle = document.createElement('style');
      hideStyle.id = 'lattice-hide-raw-style';
      hideStyle.textContent = `
        body > *:not(#lattice-extension-frame):not(#lattice-return-pill) { display: none !important; }
        html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; overflow: hidden !important; background: #070a13 !important; }
      `;
      (document.head || document.documentElement).appendChild(hideStyle);
    }

    // 2. Prepare title
    let cleanTitle = location.pathname.split('/').filter(Boolean).pop() || 'API_Response.json';
    if (!cleanTitle.includes('.')) cleanTitle += '.json';

    // 3. Cache in storage for instant reading
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        autoLoadedJson: jsonText,
        autoLoadedTitle: cleanTitle,
        autoLoadedUrl: location.href
      });
    }

    // 4. Create full-page iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'lattice-extension-frame';
    iframe.src = chrome.runtime.getURL('app.html?mode=embedded');
    iframe.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      border: none !important;
      z-index: 2147483647 !important;
      background: #070a13 !important;
      color-scheme: dark !important;
    `;

    iframe.onload = () => {
      // Send json directly via postMessage as well
      iframe.contentWindow.postMessage({
        type: 'LATTICE_LOAD_JSON',
        json: jsonText,
        title: cleanTitle,
        url: location.href
      }, '*');
    };

    document.body.appendChild(iframe);

    // 5. Create "Return to Lattice" floating pill (visible when user toggles to Raw mode)
    createReturnPill();

    // 6. Handle toggle messages from Lattice Studio
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'LATTICE_TOGGLE_RAW') {
        toggleRawView(true);
      }
    });
  }

  function toggleRawView(showRaw) {
    const iframe = document.getElementById('lattice-extension-frame');
    const hideStyle = document.getElementById('lattice-hide-raw-style');
    const pill = document.getElementById('lattice-return-pill');

    if (showRaw) {
      if (iframe) iframe.style.display = 'none';
      if (hideStyle) hideStyle.disabled = true;
      if (document.body) document.body.style.overflow = 'auto';
      if (pill) pill.style.display = 'flex';
    } else {
      if (iframe) iframe.style.display = 'block';
      if (hideStyle) hideStyle.disabled = false;
      if (document.body) document.body.style.overflow = 'hidden';
      if (pill) pill.style.display = 'none';
    }
  }

  function createReturnPill() {
    if (document.getElementById('lattice-return-pill')) return;
    const pill = document.createElement('button');
    pill.id = 'lattice-return-pill';
    pill.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      display: none;
      align-items: center !important;
      gap: 8px !important;
      background: #0f172a !important;
      color: #38bdf8 !important;
      border: 1px solid #38bdf8 !important;
      border-radius: 9999px !important;
      padding: 10px 18px !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(56, 189, 248, 0.3) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      transition: transform .15s ease !important;
    `;
    pill.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="7"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      </svg>
      <span>Back to Lattice Studio</span>
    `;
    pill.onmouseover = () => { pill.style.transform = 'translateY(-2px)'; };
    pill.onmouseout = () => { pill.style.transform = 'none'; };
    pill.onclick = () => toggleRawView(false);
    document.body.appendChild(pill);
  }

  function checkAndInit() {
    if (isJsonPage()) {
      const rawText = getRawJsonText();
      if (rawText) {
        injectFullPageViewer(rawText);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
  } else {
    checkAndInit();
  }

  // Backup check after load
  window.addEventListener('load', () => {
    if (!viewerInjected) checkAndInit();
  });
})();
