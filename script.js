/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedProductsHeading = document.querySelector(".selected-products h2");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const userInput = document.getElementById("userInput");

/* Cloudflare Worker endpoint */
const workerUrl = "https://dawn-shape-4eb6.kiazabuza.workers.dev/";

const STORAGE_KEYS = {
  selectedProductIds: "lorealSelectedProductIds",
  messages: "lorealChatMessages",
};

/* Keep product data and selected product IDs in memory */
let allProducts = [];
const selectedProductIds = new Set();
const messages = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

chatWindow.innerHTML = `
  <p class="selected-empty">Select products, click Generate Routine, then ask follow-up questions.</p>
`;

function saveSelectedProductsToStorage() {
  localStorage.setItem(
    STORAGE_KEYS.selectedProductIds,
    JSON.stringify([...selectedProductIds]),
  );
}

function loadSelectedProductsFromStorage() {
  const storedValue = localStorage.getItem(STORAGE_KEYS.selectedProductIds);

  if (!storedValue) {
    return;
  }

  try {
    const parsedIds = JSON.parse(storedValue);

    if (!Array.isArray(parsedIds)) {
      return;
    }

    parsedIds.forEach((id) => {
      const parsedId = Number(id);

      if (Number.isInteger(parsedId)) {
        selectedProductIds.add(parsedId);
      }
    });
  } catch (error) {
    console.error("Could not read saved product selections.", error);
  }
}

function saveMessagesToStorage() {
  localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
}

function loadMessagesFromStorage() {
  const storedValue = localStorage.getItem(STORAGE_KEYS.messages);

  if (!storedValue) {
    return;
  }

  try {
    const parsedMessages = JSON.parse(storedValue);

    if (!Array.isArray(parsedMessages)) {
      return;
    }

    parsedMessages.forEach((message) => {
      const isValidMessage =
        typeof message?.role === "string" &&
        typeof message?.content === "string" &&
        ["system", "user", "assistant"].includes(message.role);

      if (isValidMessage) {
        messages.push({ role: message.role, content: message.content });
      }
    });
  } catch (error) {
    console.error("Could not read saved chat history.", error);
  }
}

function renderChatHistory() {
  chatWindow.innerHTML = "";

  const visibleMessages = messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );

  if (visibleMessages.length === 0) {
    chatWindow.innerHTML = `
      <p class="selected-empty">Select products, click Generate Routine, then ask follow-up questions.</p>
    `;
    return;
  }

  visibleMessages.forEach((message) => {
    addMessageToChat(message.role, message.content);
  });
}

function ensureSystemMessage() {
  const alreadyHasSystemMessage = messages.some(
    (message) => message.role === "system",
  );

  if (alreadyHasSystemMessage) {
    return;
  }

  messages.push({
    role: "system",
    content:
      "You are a friendly skincare and beauty routine assistant for beginners. Keep advice simple, safe, practical, and concise.",
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Render assistant replies with simple readable structure (headings + lists). */
function formatAssistantMessage(text) {
  const lines = text.split("\n");
  let html = "";
  let isListOpen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (isListOpen) {
        html += "</ul>";
        isListOpen = false;
      }
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,3}\s+(.*)$/);
    const numberedItemMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    const bulletItemMatch = trimmed.match(/^[-*]\s+(.*)$/);

    if (headingMatch) {
      if (isListOpen) {
        html += "</ul>";
        isListOpen = false;
      }
      html += `<h3>${escapeHtml(headingMatch[1])}</h3>`;
      continue;
    }

    if (numberedItemMatch || bulletItemMatch) {
      if (!isListOpen) {
        html += "<ul>";
        isListOpen = true;
      }
      const listItemText = numberedItemMatch
        ? numberedItemMatch[1]
        : bulletItemMatch[1];
      html += `<li>${escapeHtml(listItemText)}</li>`;
      continue;
    }

    if (isListOpen) {
      html += "</ul>";
      isListOpen = false;
    }

    html += `<p>${escapeHtml(trimmed)}</p>`;
  }

  if (isListOpen) {
    html += "</ul>";
  }

  return html || `<p>${escapeHtml(text)}</p>`;
}

function updateMessageContent(messageDiv, role, text) {
  if (role === "assistant") {
    messageDiv.innerHTML = formatAssistantMessage(text);
    return;
  }

  messageDiv.textContent = text;
}

/* Add one chat bubble to the window */
function addMessageToChat(role, text) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${role}`;
  updateMessageContent(messageDiv, role, text);
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageDiv;
}

/* Send the full conversation to the Worker and get assistant reply */
async function getAssistantReply() {
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  if (data.reply) {
    return data.reply;
  }

  return data.choices?.[0]?.message?.content || "No response received.";
}

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

/* Show selected products in the Selected section */
function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );

  const selectedCount = selectedProducts.length;
  selectedProductsHeading.textContent = `Selected Products (${selectedCount})`;
  clearSelectionsBtn.disabled = selectedCount === 0;
  generateRoutineBtn.disabled = selectedCount === 0;

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="selected-empty">No products selected yet</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-chip">
          <span>${product.name}</span>
          <button
            type="button"
            class="selected-chip-remove"
            data-product-id="${product.id}"
            aria-label="Remove ${product.name}"
          >
            &times;
          </button>
        </div>
      `,
    )
    .join("");
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div
      class="product-card ${selectedProductIds.has(product.id) ? "selected" : ""}"
      data-product-id="${product.id}"
      role="button"
      tabindex="0"
      aria-pressed="${selectedProductIds.has(product.id)}"
      aria-describedby="product-description-${product.id}"
      aria-label="Select ${product.name}"
    >
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="product-brand">${product.brand}</p>
        <div class="description-control">
          <button
            type="button"
            class="description-toggle"
            aria-expanded="false"
            aria-controls="product-description-${product.id}"
          >
            View details
          </button>
          <div class="product-description-popover" id="product-description-${product.id}">
            <p>${product.description}</p>
          </div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

/* Toggle product selection when user clicks a card */
productsContainer.addEventListener("click", (e) => {
  const descriptionToggleBtn = e.target.closest(".description-toggle");

  if (descriptionToggleBtn) {
    const descriptionCard = descriptionToggleBtn.closest(".product-card");
    const isExpanded = descriptionCard.classList.toggle("description-expanded");

    descriptionToggleBtn.setAttribute("aria-expanded", String(isExpanded));
    descriptionToggleBtn.textContent = isExpanded
      ? "Hide details"
      : "View details";
    return;
  }

  const clickedCard = e.target.closest(".product-card");

  if (!clickedCard) {
    return;
  }

  const productId = Number(clickedCard.dataset.productId);

  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelectedProductsToStorage();

  const isSelected = selectedProductIds.has(productId);
  clickedCard.classList.toggle("selected", isSelected);
  clickedCard.setAttribute("aria-pressed", String(isSelected));
  renderSelectedProducts();
});

/* Remove products from the Selected list via X button */
selectedProductsList.addEventListener("click", (e) => {
  const removeBtn = e.target.closest(".selected-chip-remove");

  if (!removeBtn) {
    return;
  }

  const productId = Number(removeBtn.dataset.productId);
  selectedProductIds.delete(productId);

  const visibleProductCard = productsContainer.querySelector(
    `.product-card[data-product-id="${productId}"]`,
  );

  if (visibleProductCard) {
    visibleProductCard.classList.remove("selected");
    visibleProductCard.setAttribute("aria-pressed", "false");
  }

  saveSelectedProductsToStorage();
  renderSelectedProducts();
});

clearSelectionsBtn.addEventListener("click", () => {
  if (selectedProductIds.size === 0) {
    return;
  }

  selectedProductIds.clear();
  saveSelectedProductsToStorage();

  const visibleCards = productsContainer.querySelectorAll(
    ".product-card.selected",
  );
  visibleCards.forEach((card) => {
    card.classList.remove("selected");
    card.setAttribute("aria-pressed", "false");
  });

  renderSelectedProducts();
});

/* Support Enter/Space so selection is keyboard-accessible too */
productsContainer.addEventListener("keydown", (e) => {
  if (e.target.closest(".description-toggle")) {
    return;
  }

  const focusedCard = e.target.closest(".product-card");

  if (!focusedCard) {
    return;
  }

  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    focusedCard.click();
  }
});

/* Build a first routine from selected products */
generateRoutineBtn.addEventListener("click", async () => {
  const products = await loadProducts();

  const selectedProducts = products.filter((product) =>
    selectedProductIds.has(product.id),
  );

  if (selectedProducts.length === 0) {
    return;
  }

  const selectedProductsForPrompt = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  ensureSystemMessage();
  messages.push({
    role: "user",
    content: `Build me a step-by-step morning and evening routine using only these selected products.

Format requirements:
- Use short headers: "Morning Routine", "Evening Routine", and "Quick Tips"
- Use numbered steps under each routine
- Keep each step concise (1 short sentence)
- Keep total response brief and clear for beginners

Include simple usage tips (order, AM/PM, and frequency).

Selected products JSON:
${JSON.stringify(selectedProductsForPrompt, null, 2)}`,
  });
  saveMessagesToStorage();

  addMessageToChat("user", "Generate my routine using my selected products.");
  const thinkingMessage = addMessageToChat("assistant", "Thinking...");

  try {
    const reply = await getAssistantReply();
    messages.push({ role: "assistant", content: reply });
    saveMessagesToStorage();
    updateMessageContent(thinkingMessage, "assistant", reply);
  } catch (error) {
    updateMessageContent(
      thinkingMessage,
      "assistant",
      `Error: ${error.message}`,
    );
  }
});

/* Chat form submission handler for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();

  if (!text) {
    return;
  }

  ensureSystemMessage();
  messages.push({ role: "user", content: text });
  saveMessagesToStorage();
  addMessageToChat("user", text);
  const thinkingMessage = addMessageToChat("assistant", "Thinking...");

  userInput.value = "";

  try {
    const reply = await getAssistantReply();
    messages.push({ role: "assistant", content: reply });
    saveMessagesToStorage();
    updateMessageContent(thinkingMessage, "assistant", reply);
  } catch (error) {
    updateMessageContent(
      thinkingMessage,
      "assistant",
      `Error: ${error.message}`,
    );
  }
});

/* Restore saved state on page load */
async function initializeApp() {
  loadSelectedProductsFromStorage();
  loadMessagesFromStorage();
  renderChatHistory();

  const products = await loadProducts();
  const validProductIds = new Set(products.map((product) => product.id));

  [...selectedProductIds].forEach((id) => {
    if (!validProductIds.has(id)) {
      selectedProductIds.delete(id);
    }
  });

  saveSelectedProductsToStorage();
  renderSelectedProducts();
}

initializeApp();
