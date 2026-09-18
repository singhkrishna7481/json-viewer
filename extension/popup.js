document.addEventListener('DOMContentLoaded', () => {
  const btnFullTab = document.getElementById('btnFullTab');
  const btnSidePanel = document.getElementById('btnSidePanel');
  const btnQuickFormat = document.getElementById('btnQuickFormat');
  const btnQuickMinify = document.getElementById('btnQuickMinify');
  const btnQuickInspect = document.getElementById('btnQuickInspect');
  const quickTa = document.getElementById('quickTa');
  const quickStatus = document.getElementById('quickStatus');

  btnFullTab.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_studio_tab' });
    window.close();
  });

  btnSidePanel.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close();
      } else {
        chrome.runtime.sendMessage({ action: 'open_studio_tab' });
        window.close();
      }
    } catch (e) {
      chrome.runtime.sendMessage({ action: 'open_studio_tab' });
      window.close();
    }
  });

  function parseInput() {
    const raw = quickTa.value.trim();
    if (!raw) {
      quickStatus.innerHTML = '<span style="color:var(--tx3)">Scratchpad is empty</span>';
      return null;
    }
    try {
      const obj = JSON.parse(raw);
      quickStatus.innerHTML = '<span style="color:var(--ok)">✓ Valid JSON</span>';
      return obj;
    } catch (e) {
      quickStatus.innerHTML = `<span style="color:var(--err)">✗ ${e.message}</span>`;
      return null;
    }
  }

  btnQuickFormat.addEventListener('click', () => {
    const obj = parseInput();
    if (obj !== null) {
      quickTa.value = JSON.stringify(obj, null, 2);
    }
  });

  btnQuickMinify.addEventListener('click', () => {
    const obj = parseInput();
    if (obj !== null) {
      quickTa.value = JSON.stringify(obj);
    }
  });

  btnQuickInspect.addEventListener('click', () => {
    const raw = quickTa.value.trim();
    if (!raw) {
      chrome.runtime.sendMessage({ action: 'open_studio_tab' });
      window.close();
      return;
    }
    const obj = parseInput();
    if (obj !== null) {
      chrome.runtime.sendMessage({
        action: 'open_studio_with_json',
        json: quickTa.value,
        title: 'Scratchpad.json'
      });
      window.close();
    }
  });

  quickTa.addEventListener('input', () => {
    if (!quickTa.value.trim()) {
      quickStatus.textContent = '';
    } else {
      parseInput();
    }
  });
});
