/* ---------- DOM references ---------- */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/* ---------- Persistent keys ---------- */
const SELECTED_PRODUCTS_KEY = "selectedProductIds";

/* ---------- App state ---------- */
let allProducts = [];
let selectedProductIds = new Set(loadSelectedProductIds());
let openDescriptionIds = new Set();
let hasGeneratedRoutine = false;

/*
  Keep full conversation history so follow-up questions stay in context.
  The system message also keeps the assistant focused on allowed topics.
*/
const conversationHistory = [
  {
    role: "system",
    content:
      "You are a L'Oreal routine advisor. Stay focused on routine guidance and related topics: skincare, haircare, makeup, fragrance, grooming, product usage, ingredients, and safety tips. If users ask unrelated questions, politely refuse and redirect to beauty routine topics.",
  },
];

/* ---------- Helpers ---------- */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadSelectedProductIds() {
  try {
    const stored = localStorage.getItem(SELECTED_PRODUCTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Could not read selected products from localStorage", error);
    return [];
  }
}

function saveSelectedProductIds() {
  localStorage.setItem(
    SELECTED_PRODUCTS_KEY,
    JSON.stringify(Array.from(selectedProductIds)),
  );
}

function addMessage(role, content) {
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message ${role}`;
  messageEl.innerHTML = `<p>${escapeHtml(content)}</p>`;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function isAllowedFollowUp(question) {
  const relatedKeywords = [
    "routine",
    "skincare",
    "skin",
    "haircare",
    "hair",
    "makeup",
    "fragrance",
    "sunscreen",
    "spf",
    "cleanser",
    "serum",
    "moisturizer",
    "acne",
    "beauty",
    "loreal",
    "l'oreal",
    "product",
    "products",
    "ingredient",
  ];

  const normalized = question.toLowerCase();
  return relatedKeywords.some((keyword) => normalized.includes(keyword));
}

function getVisibleProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  return allProducts.filter((product) => {
    const categoryMatches =
      !selectedCategory || product.category === selectedCategory;

    const searchMatches =
      !searchTerm ||
      product.name.toLowerCase().includes(searchTerm) ||
      product.brand.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm);

    return categoryMatches && searchMatches;
  });
}

/* ---------- Product UI ---------- */
function renderProducts() {
  const visibleProducts = getVisibleProducts();

  if (!visibleProducts.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your current filters.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = visibleProducts
    .map((product) => {
      const isSelected = selectedProductIds.has(product.id);
      const isDescriptionOpen = openDescriptionIds.has(product.id);

      return `
        <article
          class="product-card ${isSelected ? "selected" : ""}"
          data-id="${product.id}"
          role="button"
          tabindex="0"
          aria-pressed="${isSelected}"
          aria-label="${escapeHtml(product.name)}"
        >
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
          <div class="product-info">
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.brand)}</p>
            <p class="product-category">${escapeHtml(product.category)}</p>
            <button
              type="button"
              class="description-toggle"
              data-desc-id="${product.id}"
              aria-expanded="${isDescriptionOpen}"
              aria-controls="desc-${product.id}"
            >
              ${isDescriptionOpen ? "Hide Description" : "Show Description"}
            </button>
            <div
              id="desc-${product.id}"
              class="product-description ${isDescriptionOpen ? "open" : ""}"
              ${isDescriptionOpen ? "" : "hidden"}
            >
              ${escapeHtml(product.description)}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );

  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `
      <p class="selected-placeholder">No products selected yet.</p>
    `;
    clearSelectionsBtn.disabled = true;
    return;
  }

  clearSelectionsBtn.disabled = false;

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-item" data-selected-id="${product.id}">
        <div>
          <p class="selected-name">${escapeHtml(product.name)}</p>
          <p class="selected-brand">${escapeHtml(product.brand)}</p>
        </div>
        <button
          type="button"
          class="remove-selected"
          data-remove-id="${product.id}"
          aria-label="Remove ${escapeHtml(product.name)}"
        >
          Remove
        </button>
      </div>
    `,
    )
    .join("");
}

function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelectedProductIds();
  renderProducts();
  renderSelectedProducts();
}

/* ---------- Data loading ---------- */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* ---------- API call through Cloudflare Worker ---------- */
async function askWorker(messages, useWebSearch = false) {
  if (!window.CLOUDFLARE_WORKER_URL) {
    throw new Error("CLOUDFLARE_WORKER_URL is not configured in secrets.js");
  }

  const response = await fetch(window.CLOUDFLARE_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      useWebSearch,
    }),
  });

  if (!response.ok) {
    throw new Error(`Worker request failed with status ${response.status}`);
  }

  const data = await response.json();

  const messageFromChatCompletions = data?.choices?.[0]?.message?.content;
  const messageFromWorker = data?.reply || data?.outputText;

  const content = messageFromWorker || messageFromChatCompletions;

  if (!content) {
    throw new Error("No assistant content was returned by the Worker.");
  }

  return {
    content,
    citations: data?.citations || [],
  };
}

/* ---------- Routine generation ---------- */
async function generateRoutine() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );

  if (!selectedProducts.length) {
    addMessage(
      "assistant",
      "Select at least one product before generating a routine.",
    );
    return;
  }

  addMessage(
    "user",
    "Generate a personalized routine with my selected products.",
  );

  const prompt = `Create a personalized daily routine (morning and evening) using ONLY the selected products below when relevant. Explain why each step is useful, include simple beginner-friendly instructions, and mention safety notes (especially SPF and active ingredients).

Selected products JSON:\n${JSON.stringify(selectedProducts, null, 2)}`;

  conversationHistory.push({ role: "user", content: prompt });

  try {
    generateRoutineBtn.disabled = true;
    generateRoutineBtn.textContent = "Generating...";

    const { content } = await askWorker(conversationHistory, true);

    conversationHistory.push({ role: "assistant", content });
    addMessage("assistant", content);
    hasGeneratedRoutine = true;
  } catch (error) {
    console.error(error);
    addMessage(
      "assistant",
      "I could not generate a routine right now. Please check your Cloudflare Worker URL and try again.",
    );
  } finally {
    generateRoutineBtn.disabled = false;
    generateRoutineBtn.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
}

/* ---------- Event listeners ---------- */
categoryFilter.addEventListener("change", () => {
  renderProducts();
});

productSearch.addEventListener("input", () => {
  renderProducts();
});

productsContainer.addEventListener("click", (event) => {
  const descriptionButton = event.target.closest(".description-toggle");
  if (descriptionButton) {
    const id = Number(descriptionButton.dataset.descId);

    if (openDescriptionIds.has(id)) {
      openDescriptionIds.delete(id);
    } else {
      openDescriptionIds.add(id);
    }

    renderProducts();
    return;
  }

  const card = event.target.closest(".product-card");
  if (!card) {
    return;
  }

  const productId = Number(card.dataset.id);
  toggleProductSelection(productId);
});

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

selectedProductsList.addEventListener("click", (event) => {
  const removeBtn = event.target.closest(".remove-selected");

  if (!removeBtn) {
    return;
  }

  const id = Number(removeBtn.dataset.removeId);
  selectedProductIds.delete(id);

  saveSelectedProductIds();
  renderProducts();
  renderSelectedProducts();
});

clearSelectionsBtn.addEventListener("click", () => {
  selectedProductIds.clear();
  saveSelectedProductIds();
  renderProducts();
  renderSelectedProducts();
});

generateRoutineBtn.addEventListener("click", generateRoutine);

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = userInput.value.trim();

  if (!question) {
    return;
  }

  if (!hasGeneratedRoutine) {
    addMessage(
      "assistant",
      "Generate a routine first, then I can answer follow-up questions about it.",
    );
    return;
  }

  if (!isAllowedFollowUp(question)) {
    addMessage(
      "assistant",
      "Please keep follow-up questions related to your routine, skincare, haircare, makeup, fragrance, or beauty products.",
    );
    return;
  }

  addMessage("user", question);
  conversationHistory.push({ role: "user", content: question });

  userInput.value = "";

  try {
    const { content, citations } = await askWorker(conversationHistory, true);

    conversationHistory.push({ role: "assistant", content });
    addMessage("assistant", content);

    if (citations.length) {
      const links = citations
        .map((citation) => citation.url || citation)
        .filter(Boolean)
        .join("\n");

      if (links) {
        addMessage("assistant", `Sources:\n${links}`);
      }
    }
  } catch (error) {
    console.error(error);
    addMessage(
      "assistant",
      "I could not answer right now. Please check your Cloudflare Worker connection and try again.",
    );
  }
});

/* ---------- Initial startup ---------- */
async function initializeApp() {
  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Loading products...
    </div>
  `;

  try {
    allProducts = await loadProducts();
    renderProducts();
    renderSelectedProducts();
    addMessage(
      "assistant",
      "Select products, generate your routine, then ask follow-up questions in chat.",
    );
  } catch (error) {
    console.error(error);
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Could not load products. Please refresh and try again.
      </div>
    `;
  }
}

initializeApp();
