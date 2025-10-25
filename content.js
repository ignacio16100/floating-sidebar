(function () {
  console.log("[Floating Sidebar] Content script loaded.");

  // ----- Storage utilities (use local to avoid sync quotas) -----
  async function getPromptsData() {
    const { promptsData } = await chrome.storage.local.get("promptsData");
    return promptsData || { order: [], texts: {} };
  }

  // ----- 1) Create/inject sidebar -----
  function createSidebar() {
    if (document.querySelector("#floating-sidebar")) {
      return; // Already exists
    }

    // Use Shadow DOM to prevent React from removing it
    const host = document.createElement("div");
    host.id = "floating-sidebar";
    host.style.position = "fixed";
    host.style.zIndex = "2147483647"; // Always on top
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    // Visual container inside the shadow DOM
    const sidebar = document.createElement("div");
    sidebar.style.cssText = `
      position: fixed;
      top: 100px;
      right: -50px;
      width: 100px;
      height: 60px;
      background:#000;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      transition:all .3s ease;
      border-top-left-radius:30px;
      border-bottom-left-radius:30px;
      overflow:hidden;
      font-family: Arial, sans-serif;
    `;
    shadow.appendChild(sidebar);

    // Icon/label
    const bookmarkLabel = document.createElement("div");
    bookmarkLabel.textContent = "";
    bookmarkLabel.style.fontSize = "24px";
    sidebar.appendChild(bookmarkLabel);

    // Button container
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display:none;
      flex-direction:column;
      align-items:flex-start;
      padding:10px;
    `;
    sidebar.appendChild(buttonContainer);

    // Function to build buttons from storage
    async function buildButtons() {
      const { order, texts } = await getPromptsData();
      buttonContainer.innerHTML = "";

      order.forEach((prompt) => {
        const btn = document.createElement("button");
        btn.textContent = prompt;
        btn.style.cssText = `
          background:none;border:none;color:#d3d3d3;
          margin:5px 0;padding:5px 0 5px 5px;cursor:pointer;
          font-size:14px;text-align:left;width:100%;
        `;
        btn.addEventListener("click", () => {
          const ta = document.querySelector('div[contenteditable="true"]');
          if (!ta) { console.error("Text area not found"); return; }

          const existing = ta.textContent.trim();
          const fromSidebar = ta.dataset.fromSidebar === "true";
          const newText = texts[prompt] || "";

          ta.textContent = (fromSidebar || !existing) ? newText : `${newText}\n\n${existing}`;
          ta.dataset.fromSidebar = "true";

          // Move cursor to the end
          const r = document.createRange();
          r.selectNodeContents(ta); r.collapse(false);
          const s = window.getSelection();
          s.removeAllRanges(); s.addRange(r);
          ta.focus();
        });
        buttonContainer.appendChild(btn);
      });
    }

    // Build buttons on load
    buildButtons();

    // Automatically update when prompts change
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.promptsData) {
        buildButtons();
      }
    });

    // Hover effect
    sidebar.addEventListener("mouseenter", () => {
      sidebar.style.right = "0";
      sidebar.style.width = "210px";
      sidebar.style.height = "auto";
      sidebar.style.borderTopLeftRadius = "10px";
      sidebar.style.borderBottomLeftRadius = "10px";
      bookmarkLabel.style.display = "none";
      buttonContainer.style.display = "flex";
    });
    sidebar.addEventListener("mouseleave", () => {
      sidebar.style.right = "-50px";
      sidebar.style.width = "100px";
      sidebar.style.height = "60px";
      sidebar.style.borderTopLeftRadius = "30px";
      sidebar.style.borderBottomLeftRadius = "30px";
      bookmarkLabel.style.display = "block";
      buttonContainer.style.display = "none";
    });
  }

  // ----- 3) Reinsert if React removes it -----
  const ensureSidebar = () => {
    if (!document.querySelector("#floating-sidebar")) {
      createSidebar();
    }
  };
  // Watch for DOM changes
  const observer = new MutationObserver(ensureSidebar);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Initial injection
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createSidebar);
  } else {
    createSidebar();
  }

  // Manual reload from popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "RELOAD_SIDEBAR") {
      const node = document.querySelector("#floating-sidebar");
      if (node) node.remove();
      createSidebar();
      sendResponse({ ok: true });
    }
  });
})();
