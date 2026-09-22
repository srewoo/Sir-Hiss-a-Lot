// Toolbar click opens the game, or focuses the tab it is already in.
//
// We remember the tab id rather than calling tabs.query({url}) — that filter is
// silently ignored unless the extension holds the "tabs" permission, which would
// make Chrome warn users about reading their browsing history for no good reason.
const TAB_KEY = 'gameTabId';

async function focusExisting() {
  const { [TAB_KEY]: id } = await chrome.storage.session.get(TAB_KEY);
  if (id === undefined) return false;
  try {
    const tab = await chrome.tabs.get(id);
    await chrome.tabs.update(id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return true;
  } catch {
    return false; // tab was closed
  }
}

chrome.action.onClicked.addListener(async () => {
  if (await focusExisting()) return;
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  await chrome.storage.session.set({ [TAB_KEY]: tab.id });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { [TAB_KEY]: id } = await chrome.storage.session.get(TAB_KEY);
  if (id === tabId) await chrome.storage.session.remove(TAB_KEY);
});
