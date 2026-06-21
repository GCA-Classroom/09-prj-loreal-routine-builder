/* Cloudflare Worker URL for OpenAI requests */
const WORKER_URL = "https://YOUR-WORKER-URL.workers.dev";

/* Local storage key used to persist selected product IDs */
const STORAGE_KEY = "selectedProductIds";

/* Initial assistant behavior for routine and beauty follow-up support */
const BASE_SYSTEM_MESSAGE = {
  role: "system",
  content:
    "You are a friendly beauty advisor. Focus on routines and related topics like skincare, haircare, makeup, fragrance, and grooming. Keep advice practical and beginner-friendly. If a question is unrelated, politely redirect back to beauty and routine topics.",
};

/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

/* App state */
let allProducts = [];
let selectedProductIds = new Set(loadSavedSelectionIds());
let activeCategory = "";
let routineGenerated = false;
let conversationHistory = [BASE_SYSTEM_MESSAGE];

/* Show initial placeholder until user selects a category */
showProductsPlaceholder();
showChatHint();

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");

  if (!response.ok) {
    throw new Error("Could not load products.json");
  }

  const data = await response.json();
  return data.products;
}

/* Read selected product IDs from localStorage */
function loadSavedSelectionIds() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

/* Save selected product IDs to localStorage */
function saveSelectedProductIds() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedProductIds]));
}

/* Render product cards for the currently selected category */
function renderProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found in this category.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProductIds.has(product.id);
      const selectedClass = isSelected ? "selected" : "";
      const selectedAria = isSelected ? "true" : "false";

      return `
        <article class="product-card ${selectedClass}" data-id="${product.id}" tabindex="0" aria-pressed="${selectedAria}">
          <div class="product-main">
            <img src="${product.image}" alt="${product.name}">
            <div class="product-info">
              <h3>${product.name}</h3>
              <p>${product.brand}</p>
              <p class="product-category">${product.category}</p>
            </div>
          </div>
          <button class="description-toggle" type="button" aria-expanded="false" aria-controls="desc-${product.id}">
            Show Description
          </button>
          <p class="product-description hidden" id="desc-${product.id}">${product.description}</p>
        </article>
      `;
    })
    .join("");
}

/* Render selected products list and controls */
function renderSelectedProducts() {
  const selectedProducts = getSelectedProducts();

  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `
      <div class="selected-placeholder">No products selected yet.</div>
    `;
    clearSelectionsBtn.disabled = true;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-item">
          <div class="selected-item-text">
            <strong>${product.name}</strong>
            <span>${product.brand}</span>
          </div>
          <button
            type="button"
            class="remove-selected-btn"
            data-remove-id="${product.id}"
            aria-label="Remove ${product.name}"
          >
            Remove
          </button>
        </div>
      `,
    )
    .join("");

  clearSelectionsBtn.disabled = false;
}

/* Return selected products as full objects */
function getSelectedProducts() {
  return allProducts.filter((product) => selectedProductIds.has(product.id));
}

/* Filter products based on selected category */
function updateGridByCategory() {
  if (!activeCategory) {
    showProductsPlaceholder();
    return;
  }

  const filteredProducts = allProducts.filter(
    (product) => product.category === activeCategory,
  );

  renderProducts(filteredProducts);
}

/* Toggle selected/unselected state on a product card */
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelectedProductIds();
  renderSelectedProducts();
  updateGridByCategory();
}

/* Toggle the description text in a product card */
function toggleDescription(buttonElement) {
  const card = buttonElement.closest(".product-card");
  const description = card.querySelector(".product-description");
  const isHidden = description.classList.contains("hidden");

  description.classList.toggle("hidden");
  buttonElement.setAttribute("aria-expanded", isHidden ? "true" : "false");
  buttonElement.textContent = isHidden
    ? "Hide Description"
    : "Show Description";
}

/* Add a message bubble to the chat window */
function addChatMessage(role, text) {
  const messageDiv = document.createElement("div");
  const roleClass = role === "user" ? "user" : "assistant";

  messageDiv.className = `chat-message ${roleClass}`;
  messageDiv.textContent = text;

  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Show text in chat while waiting for responses */
function setChatLoading(text) {
  const loadingDiv = document.createElement("div");

  loadingDiv.className = "chat-message assistant loading";
  loadingDiv.id = "chatLoadingMessage";
  loadingDiv.textContent = text;
  chatWindow.appendChild(loadingDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Remove loading message once response arrives */
function clearChatLoading() {
  const loadingDiv = document.getElementById("chatLoadingMessage");

  if (loadingDiv) {
    loadingDiv.remove();
  }
}

/* Placeholder for products grid before a category is chosen */
function showProductsPlaceholder() {
  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Select a category to view and choose products.
    </div>
  `;
}

/* Intro message in the chatbox */
function showChatHint() {
  chatWindow.innerHTML = "";
  addChatMessage(
    "assistant",
    "Select products and click Generate Routine. After that, ask follow-up beauty questions in this chat.",
  );
}

/* Build system context so the assistant uses only selected products */
function buildSelectedProductsContext(products) {
  const compactProducts = products.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  return {
    role: "system",
    content: `Use only these selected products when creating or updating the routine:\n${JSON.stringify(
      compactProducts,
      null,
      2,
    )}`,
  };
}

/* Send chat messages to the Cloudflare Worker */
async function requestAssistant(messages) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Worker request failed with status ${response.status}`);
  }

  const data = await response.json();
  const assistantText = data?.choices?.[0]?.message?.content;

  if (!assistantText) {
    throw new Error("Invalid response format from the Worker.");
  }

  return assistantText;
}

/* Generate routine from selected products */
async function generateRoutine() {
  const selectedProducts = getSelectedProducts();

  if (!selectedProducts.length) {
    addChatMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  const selectedProductsContext =
    buildSelectedProductsContext(selectedProducts);
  const generationPrompt = {
    role: "user",
    content:
      "Create a personalized daily routine using only the selected products. Include morning and evening steps, simple usage tips, and a short safety note for beginners.",
  };

  conversationHistory = [
    BASE_SYSTEM_MESSAGE,
    selectedProductsContext,
    generationPrompt,
  ];

  generateRoutineBtn.disabled = true;
  setChatLoading("Building your personalized routine...");

  try {
    const routineText = await requestAssistant(conversationHistory);
    clearChatLoading();
    addChatMessage("assistant", routineText);
    conversationHistory.push({ role: "assistant", content: routineText });
    routineGenerated = true;
  } catch (error) {
    clearChatLoading();
    addChatMessage(
      "assistant",
      "I could not generate a routine right now. Check your Worker URL and try again.",
    );
  } finally {
    generateRoutineBtn.disabled = false;
  }
}

/* Send follow-up question using full conversation history */
async function sendFollowUpQuestion(questionText) {
  if (!routineGenerated) {
    addChatMessage(
      "assistant",
      "Generate a routine first, then I can answer follow-up questions.",
    );
    return;
  }

  addChatMessage("user", questionText);
  conversationHistory.push({ role: "user", content: questionText });

  setChatLoading("Thinking...");

  try {
    const assistantReply = await requestAssistant(conversationHistory);
    clearChatLoading();
    addChatMessage("assistant", assistantReply);
    conversationHistory.push({ role: "assistant", content: assistantReply });
  } catch (error) {
    clearChatLoading();
    addChatMessage(
      "assistant",
      "I could not answer that right now. Please try again in a moment.",
    );
  }
}

/* Category change updates product grid */
categoryFilter.addEventListener("change", (event) => {
  activeCategory = event.target.value;
  updateGridByCategory();
});

/* Card clicks support both selection and description toggle */
productsContainer.addEventListener("click", (event) => {
  const toggleBtn = event.target.closest(".description-toggle");

  if (toggleBtn) {
    toggleDescription(toggleBtn);
    return;
  }

  const card = event.target.closest(".product-card");

  if (!card) {
    return;
  }

  const productId = Number(card.dataset.id);
  toggleProductSelection(productId);
});

/* Keyboard support for selecting cards */
productsContainer.addEventListener("keydown", (event) => {
  const card = event.target.closest(".product-card");

  if (!card) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const productId = Number(card.dataset.id);
    toggleProductSelection(productId);
  }
});

/* Remove selected item directly from the saved list */
selectedProductsList.addEventListener("click", (event) => {
  const removeBtn = event.target.closest(".remove-selected-btn");

  if (!removeBtn) {
    return;
  }

  const removeId = Number(removeBtn.dataset.removeId);
  selectedProductIds.delete(removeId);
  saveSelectedProductIds();
  renderSelectedProducts();
  updateGridByCategory();
});

/* Clear all selected products and localStorage */
clearSelectionsBtn.addEventListener("click", () => {
  selectedProductIds.clear();
  saveSelectedProductIds();
  renderSelectedProducts();
  updateGridByCategory();
});

/* Generate routine button */
generateRoutineBtn.addEventListener("click", generateRoutine);

/* Follow-up chat form */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const questionText = userInput.value.trim();

  if (!questionText) {
    return;
  }

  userInput.value = "";
  await sendFollowUpQuestion(questionText);
});

/* Load products and restore selected list */
async function initializeApp() {
  try {
    allProducts = await loadProducts();

    /* Keep only IDs that still exist in the latest product data */
    const validIds = new Set(allProducts.map((product) => product.id));
    selectedProductIds = new Set(
      [...selectedProductIds].filter((id) => validIds.has(id)),
    );
    saveSelectedProductIds();

    renderSelectedProducts();
  } catch (error) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Could not load products right now. Please refresh the page.
      </div>
    `;
  }
}

initializeApp();
