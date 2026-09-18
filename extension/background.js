// Background Service Worker for Lattice JSON Studio Pro

chrome.runtime.onInstalled.addListener(() => {
  // Create Context Menus
  chrome.contextMenus.create({
    id: "open_selection_in_lattice",
    title: "Open selected JSON in Lattice Studio",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "open_link_in_lattice",
    title: "Open JSON link in Lattice Studio",
    contexts: ["link"]
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open_selection_in_lattice" && info.selectionText) {
    const text = info.selectionText.trim();
    openStudioWithJson(text, "Selected_Snippet.json");
  } else if (info.menuItemId === "open_link_in_lattice" && info.linkUrl) {
    fetch(info.linkUrl)
      .then(r => r.text())
      .then(text => {
        const name = info.linkUrl.split("/").pop() || "Fetched.json";
        openStudioWithJson(text, name);
      })
      .catch(err => {
        console.error("Failed to fetch link URL:", err);
      });
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "open_studio") {
    openStudioTab();
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "open_studio_with_json") {
    openStudioWithJson(msg.json, msg.title || "Page_Data.json");
    sendResponse({ success: true });
  } else if (msg.action === "open_side_panel") {
    if (sender.tab && sender.tab.windowId && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId });
      sendResponse({ success: true });
    }
  } else if (msg.action === "open_studio_tab") {
    openStudioTab();
    sendResponse({ success: true });
  }
  return true;
});

function openStudioWithJson(jsonText, title) {
  chrome.storage.local.set({
    pendingJson: jsonText,
    pendingTitle: title
  }, () => {
    openStudioTab();
  });
}

function openStudioTab() {
  const url = chrome.runtime.getURL("app.html");
  chrome.tabs.create({ url });
}
