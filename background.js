// Create context menu and initialize default data (with sync -> local migration)
chrome.runtime.onInstalled.addListener(async () => {
  // Migrate any old data from chrome.storage.sync to chrome.storage.local and clear sync
  try {
    const fromSync = await chrome.storage.sync.get(null);
    if (fromSync && (fromSync.promptsData || Object.keys(fromSync).length)) {
      if (fromSync.promptsData) {
        await chrome.storage.local.set({ promptsData: fromSync.promptsData });
      }
      await chrome.storage.sync.clear();
    }
  } catch (e) {
    // Ignore migration errors silently
  }

  // Create context menu for "Paste into ChatGPT"
  chrome.contextMenus.create({
    id: "pasteInGPT",
    title: "Paste into ChatGPT",
    contexts: ["selection"] // Only shown when there is selected text
  });

  // Initialize default prompts if none exist (use storage.local to avoid sync quotas)
  const { promptsData } = await chrome.storage.local.get("promptsData");
  if (!promptsData) {
    const defaultPrompts = [
      "Summarize",
      "Rewrite clearly",
      "Brainstorm ideas"
    ];

    const defaultTexts = {
      "Summarize": "Summarize the following text into 5–7 clear bullet points. Keep facts, names, numbers, and dates. Avoid opinions and do not add new information. End with one sentence that captures the main takeaway:",
      "Rewrite clearly": "Rewrite the following text to be clearer, shorter, and neutral. Keep factual accuracy, remove redundancy, split long sentences, and use plain language. Preserve any quoted text exactly as-is. Return the result in paragraphs:",
      "Brainstorm ideas": "Generate a list of 10 practical ideas based on the context below. For each idea, include a short explanation of why it could work and a first actionable step:"
    };

    await chrome.storage.local.set({
      promptsData: { order: defaultPrompts, texts: defaultTexts }
    });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info) => {
  if (!info.selectionText) return;

  const chatGPTUrl = "https://chat.openai.com";
  chrome.tabs.create({ url: chatGPTUrl }, (newTab) => {
    const listener = (tabId, changeInfo) => {
      if (tabId === newTab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);

        chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          func: (text) => {
            // Retry until the editable area exists
            const tryPaste = () => {
              const textArea = document.querySelector('div[contenteditable="true"]');
              if (textArea) {
                textArea.textContent = text;
                textArea.focus();
                // Move cursor to the end
                const range = document.createRange();
                range.selectNodeContents(textArea);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
              } else {
                setTimeout(tryPaste, 300);
              }
            };
            tryPaste();
          },
          args: [info.selectionText],
        });
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
});
