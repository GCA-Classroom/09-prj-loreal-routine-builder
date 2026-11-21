/* =====================================================
   L'Oréal Routine Builder
   Plain JavaScript only: no npm, no imports, no API keys.
   The browser talks to a Cloudflare Worker, and the Worker
   talks to OpenAI (the Worker holds the secret key).
   ===================================================== */

/* ---------- Get references to DOM elements ---------- */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("product-search");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearAllBtn = document.getElementById("clearAllBtn");
const generateBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const rtlToggle = document.getElementById("rtlToggle");

/* ---------- Constants ---------- */

/* STEP 8: the deployed Cloudflare Worker (NO API key lives in this file) */
const WORKER_URL = "https://lively-hall-d51b.yens537234-cloudflare.workers.dev/";

/* localStorage keys */
const STORAGE_KEY = "loreal-selected-products";
const DIRECTION_KEY = "loreal-direction";

/* The instructions the AI follows for the whole conversation */
const SYSTEM_PROMPT =
  "You are a L'Oréal beauty advisor. Create a personalized step-by-step routine using ONLY the products the user selected. Order the steps (e.g., cleanse → treat → moisturize → protect). For each step, name the product, brand, and 1–2 sentences on how to use it. Keep the routine under 200 words. Only answer follow-ups about skincare, haircare, makeup, fragrance, or L'Oréal products.";

/* ---------- State ---------- */

/* STEP 1: every product the user has selected */
let selectedProducts = [];

/* The products currently shown in the grid (so a card click can find its product) */
let displayedProducts = [];

/* All products from products.json (loaded once, then reused) */
let allProducts = [];

/* STEP 4/5: the FULL conversation. It is sent to the Worker on every request,
   which is how the AI "remembers" (the server keeps no memory). */
const messages = [{ role: "system", content: SYSTEM_PROMPT }];

/* =====================================================
   Small helpers
   ===================================================== */

/* Make text safe to put inside HTML so it cannot inject tags */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Make a stable id for a product, like "cerave-foaming-facial-cleanser" */
function makeProductId(product) {
  return `${product.name} ${product.brand}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // turn anything that isn't a letter/number into "-"
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

/* Wait until the user stops typing for `delay` ms before running `fn` */
function debounce(fn, delay) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
}

/* =====================================================
   Loading + showing products
   ===================================================== */

/* Load product data from the JSON file (only fetches the first time) */
async function loadProducts() {
  if (allProducts.length === 0) {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products;
  }
  return allProducts;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  // Remember what is on screen so clicks can find the right product
  displayedProducts = products;

  productsContainer.innerHTML = products
    .map((product) => {
      const id = makeProductId(product);
      const selected = isSelected(product);
      return `
    <div class="product-card ${selected ? "selected" : ""}"
         data-product-id="${id}"
         tabindex="0"
         role="group"
         aria-label="${escapeHtml(product.name)} by ${escapeHtml(product.brand)}${selected ? ", selected" : ""}">
      <div class="card-main">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
        <div class="product-info">
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.brand)}</p>
        </div>
      </div>
      <button type="button" class="details-btn"
              aria-expanded="false"
              aria-controls="desc-${id}">ⓘ Details</button>
      <div class="product-description" id="desc-${id}" hidden>
        ${escapeHtml(product.description)}
      </div>
    </div>`;
    })
    .join("");
}

/* STEP 6: show products that match BOTH the category and the search text */
async function applyFilters() {
  const products = await loadProducts();
  const category = categoryFilter.value;
  const query = productSearch.value.trim().toLowerCase();

  // Nothing chosen and nothing typed: show the starting message
  if (!category && !query) {
    displayedProducts = [];
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category or search to view products
      </div>`;
    return;
  }

  const filtered = products.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const searchableText =
      `${product.name} ${product.brand} ${product.description}`.toLowerCase();
    const matchesSearch = !query || searchableText.includes(query);
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    displayedProducts = [];
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your search
      </div>`;
    return;
  }

  displayProducts(filtered);
}

/* Re-filter right away when the category changes */
categoryFilter.addEventListener("change", applyFilters);

/* Re-filter 150ms after the user stops typing in the search box */
productSearch.addEventListener("input", debounce(applyFilters, 150));

/* =====================================================
   STEP 1: Selecting products
   ===================================================== */

/* Check whether a product is currently selected */
function isSelected(product) {
  return selectedProducts.some(
    (p) => makeProductId(p) === makeProductId(product)
  );
}

/* Add the product if it is not selected, remove it if it is (used by cards AND pills) */
function toggleProduct(product) {
  const id = makeProductId(product);

  if (isSelected(product)) {
    // Keep everything except this product
    selectedProducts = selectedProducts.filter((p) => makeProductId(p) !== id);
  } else {
    selectedProducts.push(product);
  }

  saveSelection();
  updateSelectionUI();
}

/* Remove every selected product at once (also wipes localStorage) */
function clearAllProducts() {
  selectedProducts = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear saved products:", error);
  }
  updateSelectionUI();
}

/* Keep the grid cards and the pill list in sync with selectedProducts */
function updateSelectionUI() {
  // Add or remove the "selected" class on each visible card
  document.querySelectorAll(".product-card").forEach((card) => {
    const product = displayedProducts.find(
      (p) => makeProductId(p) === card.dataset.productId
    );
    const selected = product ? isSelected(product) : false;
    card.classList.toggle("selected", selected);
    if (product) {
      card.setAttribute(
        "aria-label",
        `${product.name} by ${product.brand}${selected ? ", selected" : ""}`
      );
    }
  });

  renderSelectedList();
}

/* Build one pill (with an "×" remove button) for every selected product */
function renderSelectedList() {
  selectedProductsList.innerHTML = "";

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="no-selection">No products selected yet.</p>`;
    clearAllBtn.hidden = true;
    return;
  }

  clearAllBtn.hidden = false;

  selectedProducts.forEach((product) => {
    const pill = document.createElement("span");
    pill.className = "selected-pill";
    pill.dataset.productId = makeProductId(product);
    pill.textContent = `${product.brand} ${product.name}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "pill-remove";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${product.name}`);
    removeBtn.addEventListener("click", () => toggleProduct(product));

    pill.appendChild(removeBtn);
    selectedProductsList.appendChild(pill);
  });
}

/* Find the product behind a card element and toggle it */
function toggleCardFromElement(card) {
  const product = displayedProducts.find(
    (p) => makeProductId(p) === card.dataset.productId
  );
  if (product) toggleProduct(product);
}

/* One click listener handles every card (and every Details button) */
productsContainer.addEventListener("click", (e) => {
  // STEP 2: the Details button only opens/closes the description
  const detailsBtn = e.target.closest(".details-btn");
  if (detailsBtn) {
    toggleDetails(detailsBtn);
    return;
  }

  const card = e.target.closest(".product-card");
  if (card) toggleCardFromElement(card);
});

/* Let keyboard users select a focused card with Enter or Space */
productsContainer.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".product-card");
  // Only react when the CARD itself is focused (not the Details button inside it)
  if (!card || e.target !== card) return;
  e.preventDefault();
  toggleCardFromElement(card);
});

clearAllBtn.addEventListener("click", clearAllProducts);

/* =====================================================
   STEP 2: Show / hide the product description
   ===================================================== */

/* Expand or collapse the description under a card and update the ARIA state */
function toggleDetails(button) {
  const description = document.getElementById(
    button.getAttribute("aria-controls")
  );
  const isOpen = button.getAttribute("aria-expanded") === "true";

  button.setAttribute("aria-expanded", String(!isOpen));
  button.textContent = isOpen ? "ⓘ Details" : "ⓘ Hide details";
  description.hidden = isOpen;
}

/* =====================================================
   STEP 3: Save and restore selections with localStorage
   ===================================================== */

/* Save the selected products so they survive a page refresh */
function saveSelection() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProducts));
  } catch (error) {
    console.error("Could not save selected products:", error);
  }
}

/* Read saved products on page load; fall back to [] if anything is wrong */
function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    // Keep only entries that look like real products
    return saved.filter(
      (item) =>
        item && typeof item.name === "string" && typeof item.brand === "string"
    );
  } catch (error) {
    // Corrupted JSON or storage blocked: start fresh
    return [];
  }
}

/* =====================================================
   Chat window
   ===================================================== */

/* Add a message bubble to the chat window and return it */
function displayMessage(text, className) {
  const bubble = document.createElement("div");
  bubble.className = `msg ${className}`;

  if (className === "ai") {
    // Escape first (safe), then turn **bold** into <strong> and newlines into <br>
    bubble.innerHTML = escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  } else {
    bubble.textContent = text;
  }

  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

/* Send the FULL messages array to the Worker and return the assistant's text */
async function sendToWorker() {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages }),
  });

  if (!response.ok) {
    throw new Error("The chatbot service returned an error.");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/* Turn the Generate / Send buttons on or off while waiting for the AI */
function setBusy(isBusy) {
  generateBtn.disabled = isBusy;
  sendBtn.disabled = isBusy;
}

/* Show a friendly greeting when the page opens */
displayMessage(
  "👋 Hi! Select some products, then click “Generate Routine”. You can also ask me questions.",
  "ai"
);

/* =====================================================
   STEP 4: Generate Routine
   ===================================================== */

/* Send the selected products to the AI and show the routine it builds */
async function generateRoutine() {
  // Need at least one product to build a routine
  if (selectedProducts.length === 0) {
    displayMessage("Select at least one product first 🙂", "ai");
    return;
  }

  // Only send the fields the AI needs
  const productData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const userText = `Here are my selected products:\n${JSON.stringify(productData)}`;

  // Save this turn in the shared conversation (the system prompt is already first)
  messages.push({ role: "user", content: userText });
  displayMessage(
    `Build my routine with ${selectedProducts.length} selected product${selectedProducts.length === 1 ? "" : "s"}.`,
    "user"
  );

  setBusy(true);
  const thinkingBubble = displayMessage("Thinking…", "ai thinking");

  try {
    const reply = await sendToWorker();
    messages.push({ role: "assistant", content: reply });
    thinkingBubble.remove();
    displayMessage(reply, "ai");
  } catch (error) {
    // Undo the user turn so the history stays clean, then tell the user
    messages.pop();
    thinkingBubble.remove();
    displayMessage(
      "Sorry, I could not connect to the beauty advisor right now.",
      "ai"
    );
    console.error("Routine request failed:", error);
  }

  setBusy(false);
}

generateBtn.addEventListener("click", generateRoutine);

/* =====================================================
   STEP 5: Follow-up chat (memory)
   Each question is added to the SAME messages array that holds the
   routine, and the whole array is sent every time. Off-topic questions
   are handled by the system prompt (no hard-coded keyword blocks).
   ===================================================== */

/* Send a typed question to the AI along with the whole conversation */
async function handleChatSubmit(event) {
  event.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  messages.push({ role: "user", content: userText });
  displayMessage(userText, "user");
  userInput.value = "";

  setBusy(true);
  const thinkingBubble = displayMessage("Thinking…", "ai thinking");

  try {
    const reply = await sendToWorker();
    messages.push({ role: "assistant", content: reply });
    thinkingBubble.remove();
    displayMessage(reply, "ai");
  } catch (error) {
    messages.pop(); // remove the question that failed
    thinkingBubble.remove();
    displayMessage(
      "Sorry, I could not connect to the beauty advisor right now.",
      "ai"
    );
    console.error("Chat request failed:", error);
  }

  setBusy(false);
  userInput.focus();
}

chatForm.addEventListener("submit", handleChatSubmit);

/* =====================================================
   STEP 7: RTL / LTR toggle
   ===================================================== */

/* Set the page direction ("rtl" or "ltr") and remember the choice */
function setDirection(direction) {
  document.documentElement.dir = direction;
  rtlToggle.setAttribute("aria-pressed", String(direction === "rtl"));
  try {
    localStorage.setItem(DIRECTION_KEY, direction);
  } catch (error) {
    console.error("Could not save direction:", error);
  }
}

/* Switch between right-to-left and left-to-right */
function toggleDirection() {
  setDirection(document.documentElement.dir === "rtl" ? "ltr" : "rtl");
}

rtlToggle.addEventListener("click", toggleDirection);

/* =====================================================
   Page start-up
   ===================================================== */

/* Restore the saved text direction (default is left-to-right) */
function restoreDirection() {
  let saved = "ltr";
  try {
    saved = localStorage.getItem(DIRECTION_KEY) === "rtl" ? "rtl" : "ltr";
  } catch (error) {
    // Storage blocked: keep the default
  }
  setDirection(saved);
}

restoreDirection();

/* STEP 3: bring back saved products and draw the pills */
selectedProducts = loadSelection();
renderSelectedList();

/* Show the starting message in the product grid */
applyFilters();
