// ==== Storage helpers (use local to avoid quotas) ====
async function getPromptsData() {
  const { promptsData } = await chrome.storage.local.get("promptsData");
  return promptsData || { order: [], texts: {} };
}
async function setPromptsData(data) {
  await chrome.storage.local.set({ promptsData: data });
}

// ==== Render list ====
async function renderList() {
  const cont = document.getElementById("prompts-list");
  cont.innerHTML = "";
  const { order, texts } = await getPromptsData();
  if (!order.length) {
    cont.textContent = "No prompts defined.";
    return;
  }

  order.forEach((name, idx) => {
    const wrap = document.createElement("div");
    wrap.style.border = "1px solid #ddd";
    wrap.style.padding = "8px";
    wrap.style.marginBottom = "8px";
    wrap.style.borderRadius = "4px";
    wrap.style.background = "#fff";

    const title = document.createElement("div");
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.justifyContent = "space-between";
    title.innerHTML = `<strong>${name}</strong>`;
    wrap.appendChild(title);

    const ta = document.createElement("textarea");
    ta.rows = 4;
    ta.value = texts[name] || "";
    ta.style.width = "100%";
    ta.style.marginTop = "6px";
    wrap.appendChild(ta);

    // Buttons
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginTop = "6px";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const data = await getPromptsData();
      data.texts[name] = ta.value;
      await setPromptsData(data);
      await renderList();
    });
    row.appendChild(saveBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      const data = await getPromptsData();
      data.order = data.order.filter(n => n !== name);
      delete data.texts[name];
      await setPromptsData(data);
      await renderList();
    });
    row.appendChild(delBtn);

    // Reorder
    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.title = "Move up";
    upBtn.addEventListener("click", async () => {
      const data = await getPromptsData();
      if (idx > 0) {
        const tmp = data.order[idx - 1];
        data.order[idx - 1] = data.order[idx];
        data.order[idx] = tmp;
        await setPromptsData(data);
        await renderList();
      }
    });
    row.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.title = "Move down";
    downBtn.addEventListener("click", async () => {
      const data = await getPromptsData();
      if (idx < data.order.length - 1) {
        const tmp = data.order[idx + 1];
        data.order[idx + 1] = data.order[idx];
        data.order[idx] = tmp;
        await setPromptsData(data);
        await renderList();
      }
    });
    row.appendChild(downBtn);

    wrap.appendChild(row);
    cont.appendChild(wrap);
  });
}

// ==== Add prompt ====
document.getElementById("add-prompt").addEventListener("click", async () => {
  const name = document.getElementById("prompt-name").value.trim();
  const text = document.getElementById("prompt-text").value;
  if (!name) { alert("Enter a name for the prompt."); return; }

  const data = await getPromptsData();
  if (data.order.includes(name)) {
    alert("A prompt with that name already exists.");
    return;
  }
  data.order.push(name);
  data.texts[name] = text || "";
  await setPromptsData(data);

  document.getElementById("prompt-name").value = "";
  document.getElementById("prompt-text").value = "";
  await renderList();
});

// ==== Reload sidebar in the current tab ====
document.getElementById("reload-sidebar").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "RELOAD_SIDEBAR" }, () => {});
  });
});

// ==== Initialize ====
(async () => {
  await renderList();
})();
