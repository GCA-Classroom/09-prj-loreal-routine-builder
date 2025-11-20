/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
/* NEW: search input reference */
const productSearch = document.getElementById("productSearch");

/* ---------- new: cache for all products so search+category work together ---------- */
let allProducts = []; // filled when loadProducts() resolves

/* Track selected products (ids) */
const selectedProducts = new Set();

/* Persist selection to localStorage */
function saveSelectedToStorage() {
  try {
    const arr = Array.from(selectedProducts);
    localStorage.setItem("selectedProducts", JSON.stringify(arr));
  } catch (err) {
    // ignore storage errors (private mode etc.)
    console.warn("Could not save selected products", err);
  }
}

function loadSelectedFromStorage() {
  try {
    const raw = localStorage.getItem("selectedProducts");
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach((id) => selectedProducts.add(Number(id)));
    }
  } catch (err) {
    console.warn("Could not load selected products", err);
  }
}

// initialize from storage
loadSelectedFromStorage();
// show persisted selections on load
renderSelectedProducts();

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

// Also load and show all products on initial page load
loadProducts()
  .then((products) => {
    allProducts = products || []; // cache full list
    displayProducts(allProducts); // initial render
  })
  .catch((err) => {
    console.error("Could not load products.json:", err);
    productsContainer.innerHTML =
      '<div class="placeholder-message">Could not load products. See console for details.</div>';
  });

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* ---------- new: helper that applies category + search filters ---------- */
function applyFilters() {
  const selectedCategory = categoryFilter ? categoryFilter.value : "";
  const q = productSearch ? productSearch.value.trim().toLowerCase() : "";

  return allProducts.filter((product) => {
    // filter by category if a category is selected
    if (selectedCategory && product.category !== selectedCategory) return false;

    // if no search query, include the product
    if (!q) return true;

    // check name, brand, description, and category for the search term
    const hay = (
      (product.name || "") +
      " " +
      (product.brand || "") +
      " " +
      (product.description || "") +
      " " +
      (product.category || "")
    ).toLowerCase();

    return hay.includes(q);
  });
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", (e) => {
  // display results that satisfy both category and any active search query
  const filtered = applyFilters();
  displayProducts(filtered);
});

/* Add input event on the search box to filter as the user types */
if (productSearch) {
  productSearch.addEventListener("input", (e) => {
    const filtered = applyFilters();
    displayProducts(filtered);
  });
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${
      selectedProducts.has(product.id) ? "selected" : ""
    }" role="button" tabindex="0" aria-pressed="${
        selectedProducts.has(product.id) ? "true" : "false"
      }" data-id="${product.id}">
      <img src="${product.image}" alt="${
        product.name
      }" tabindex="0" onerror="(function(img){console.warn('Image failed to load:', img.src); img.onerror=null; img.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'110\' height=\'110\'><rect width=\'100%\' height=\'100%\' fill=\'%23f5f5f5\' /><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23666\' font-size=\'12\'>No image</text></svg>'; })(this);">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="brand">${product.brand}</p>
        <button class="toggle-desc" aria-expanded="false" aria-controls="desc-${
          product.id
        }">Details</button>
        <p id="desc-${
          product.id
        }" class="product-description" aria-hidden="true" data-full="${encodeURIComponent(
        product.description
      )}">${product.description.slice(0, 120)}${
        product.description.length > 120 ? "…" : ""
      }</p>
      </div>
    </div>
  `
    )
    .join("");

  // After rendering, update the Selected Products list display
  renderSelectedProducts();
}

/* Event delegation for toggling product descriptions (accessible) */
productsContainer.addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-desc");
  const clickedCard = e.target.closest(".product-card");
  if (!btn) return;

  const card = btn.closest(".product-card");
  const desc = card.querySelector(".product-description");

  const expanded = btn.getAttribute("aria-expanded") === "true";

  const full = decodeURIComponent(desc.dataset.full || "");
  const short = full.length > 120 ? full.slice(0, 120) + "…" : full;

  btn.setAttribute("aria-expanded", String(!expanded));
  desc.setAttribute("aria-hidden", String(expanded));

  if (!expanded) {
    // expanding: show full text
    desc.textContent = full;
    desc.classList.add("open");
    btn.textContent = "Hide details";
  } else {
    // collapsing: show truncated text
    desc.textContent = short;
    desc.classList.remove("open");
    btn.textContent = "Details";
  }
});

/* Click/tap on a product card toggles selection (but ignore clicks on the Details button) */
productsContainer.addEventListener("click", (e) => {
  if (e.target.closest(".toggle-desc")) return; // don't toggle when pressing Details

  const card = e.target.closest(".product-card");
  if (!card) return;

  const id = Number(card.dataset.id);
  toggleSelect(id, card);
});

/* Keyboard support for selecting via Enter/Space on the card */
productsContainer.addEventListener("keydown", (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return;

  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    const id = Number(card.dataset.id);
    toggleSelect(id, card);
  }
});

/* Toggle selection helper */
function toggleSelect(id, cardNode) {
  if (selectedProducts.has(id)) {
    selectedProducts.delete(id);
    cardNode.classList.remove("selected");
    cardNode.setAttribute("aria-pressed", "false");
  } else {
    selectedProducts.add(id);
    cardNode.classList.add("selected");
    cardNode.setAttribute("aria-pressed", "true");
  }

  renderSelectedProducts();
  saveSelectedToStorage();
}

/* Clear all selections helper */
function clearAllSelections() {
  selectedProducts.clear();

  // remove selected class from any rendered cards
  const cards = productsContainer.querySelectorAll(".product-card.selected");
  cards.forEach((c) => {
    c.classList.remove("selected");
    c.setAttribute("aria-pressed", "false");
  });

  renderSelectedProducts();
  saveSelectedToStorage();
}

/* Render selected products as chips in the Selected Products area */
function renderSelectedProducts() {
  const list = document.getElementById("selectedProductsList");
  if (!list) return;

  if (selectedProducts.size === 0) {
    list.innerHTML = '<p class="none">No products selected</p>';
    return;
  }

  // Load all products once and map ids to names (simple cached approach)
  loadProducts().then((products) => {
    const byId = Object.fromEntries(products.map((p) => [String(p.id), p]));

    list.innerHTML = Array.from(selectedProducts)
      .map((id) => {
        const prod = byId[String(id)];
        const name = prod ? prod.name : `#${id}`;
        return `<span class="selected-chip" data-id="${id}">${name} <button class="chip-remove" aria-label="Remove ${name}">&times;</button></span>`;
      })
      .join("");
  });
}

/* Allow removing from selected list by clicking the chip remove button */
document
  .getElementById("selectedProductsList")
  .addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-remove");
    if (!btn) return;

    const chip = btn.closest(".selected-chip");
    const id = Number(chip.dataset.id);

    // find corresponding card and update its state
    const card = productsContainer.querySelector(
      `.product-card[data-id="${id}"]`
    );
    if (card) {
      selectedProducts.delete(id);
      card.classList.remove("selected");
      card.setAttribute("aria-pressed", "false");
    }

    renderSelectedProducts();
    saveSelectedToStorage();
  });

/* Clear selections button */
const clearBtn = document.getElementById("clearSelections");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    clearAllSelections();
  });
}

/* Return selected product objects (loads products.json and matches ids) */
async function getSelectedProductObjects() {
  if (selectedProducts.size === 0) return [];
  const products = await loadProducts();
  const byId = Object.fromEntries(products.map((p) => [String(p.id), p]));
  return Array.from(selectedProducts)
    .map((id) => byId[String(id)])
    .filter(Boolean);
}

/* Conversation state so follow-up questions are contextual.
   Start with a system prompt describing the assistant's role. */
const conversationMessages = [
  {
    role: "system",
    content:
      "You are a helpful assistant that creates concise, step-by-step skincare routines from a list of products and can answer follow-up questions about those routines and the products.",
  },
];

/* Helper: append a simple message bubble to the chat window */
function appendMessageToChat(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`; // CSS can style .chat-bubble.user/.assistant
  bubble.innerText = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Core OpenAI call: sends `messages` (array) to the Chat Completions endpoint.
   Uses async/await and returns the assistant text. Does not include `temperature`. */
async function callOpenAIChat(messages) {
  // Read key from window.APP_SECRETS (set by js/secrets.js)
  const key = window.APP_SECRETS && window.APP_SECRETS.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OpenAI API key not found. Make sure js/secrets.js sets window.APP_SECRETS.OPENAI_API_KEY."
    );
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o", // workspace default; change only if requested
      messages: messages,
      // NOTE: intentionally no `temperature` to avoid incompatible-model errors
    }),
  });

  // If non-OK, try to read JSON body for helpful error info
  if (!resp.ok) {
    const bodyText = await resp.text();
    try {
      const json = JSON.parse(bodyText);
      throw new Error(
        `OpenAI API error: ${resp.status} ${JSON.stringify(json)}`
      );
    } catch (err) {
      throw new Error(`OpenAI API error: ${resp.status} ${bodyText}`);
    }
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from OpenAI.");
  }
  return content;
}

/* Generate a routine by sending selected products to OpenAI's Chat Completions API */
async function generateRoutineWithOpenAI(selectedProductsArray) {
  // Build a single user message that lists the selected products and asks for a short routine.
  const productListText = selectedProductsArray
    .map((p) => `- ${p.name} (${p.brand}): ${p.description}`)
    .join("\n");

  const userMessage = {
    role: "user",
    content:
      "Create a concise, step-by-step skincare routine using only the following products. For each step, mention the product name and a short reason for using it.\n\n" +
      productListText +
      "\n\nKeep it short and use numbered steps.",
  };

  // Add user's request to the conversation so follow-ups remain contextual
  conversationMessages.push(userMessage);

  // Show the user's request in UI and a temporary assistant indicator
  appendMessageToChat("user", "Generate routine from selected products");
  appendMessageToChat("assistant", "Thinking…");

  try {
    // Call OpenAI with the full conversation
    const reply = await callOpenAIChat(conversationMessages);

    // Remove the "Thinking…" bubble (last assistant bubble)
    const lastBubble = chatWindow.querySelector(
      ".chat-bubble.assistant:last-child"
    );
    if (lastBubble && lastBubble.innerText === "Thinking…") {
      lastBubble.remove();
    }

    // Save assistant reply into conversation state and UI
    conversationMessages.push({ role: "assistant", content: reply });
    appendMessageToChat("assistant", reply);

    return reply;
  } catch (err) {
    // Replace the "Thinking…" bubble with an error
    const lastBubble = chatWindow.querySelector(
      ".chat-bubble.assistant:last-child"
    );
    if (lastBubble && lastBubble.innerText === "Thinking…") {
      lastBubble.innerText = `Error: ${err.message}`;
      lastBubble.classList.add("error");
    } else {
      appendMessageToChat("assistant", `Error: ${err.message}`);
    }
    console.error("Error generating routine:", err);
    throw err;
  }
}

/* Generate Routine button: collect only selected products and request a routine */
const generateBtn = document.getElementById("generateRoutine");
if (generateBtn) {
  generateBtn.addEventListener("click", async () => {
    try {
      const selectedObjs = await getSelectedProductObjects(); // existing helper in your file
      if (!selectedObjs || selectedObjs.length === 0) {
        appendMessageToChat(
          "assistant",
          "Please select at least one product to generate a routine."
        );
        return;
      }
      await generateRoutineWithOpenAI(selectedObjs);
    } catch (err) {
      appendMessageToChat(
        "assistant",
        `Sorry — could not generate routine. ${err.message}`
      );
    }
  });
}

/* Chat form submission handler - allows follow-up questions after a routine is generated */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  // Show user's message in UI and add to conversation
  appendMessageToChat("user", text);
  conversationMessages.push({ role: "user", content: text });

  // Show assistant typing indicator
  appendMessageToChat("assistant", "Thinking…");

  try {
    const reply = await callOpenAIChat(conversationMessages);

    // remove the "Thinking…" bubble (it's the last assistant bubble)
    const lastBubble = chatWindow.querySelector(
      ".chat-bubble.assistant:last-child"
    );
    if (lastBubble && lastBubble.innerText === "Thinking…") {
      lastBubble.remove();
    }

    // add assistant reply to convo state and UI
    conversationMessages.push({ role: "assistant", content: reply });
    appendMessageToChat("assistant", reply);
  } catch (err) {
    const lastBubble = chatWindow.querySelector(
      ".chat-bubble.assistant:last-child"
    );
    if (lastBubble && lastBubble.innerText === "Thinking…") {
      lastBubble.innerText = `Error: ${err.message}`;
      lastBubble.classList.add("error");
    } else {
      appendMessageToChat("assistant", `Error: ${err.message}`);
    }
    console.error("Chat error:", err);
  }
});

/* NOTE: Removed duplicated "Beginner-friendly chat with persistent conversation history"
   block here that re-declared chatWindow/chatForm/userInput and duplicated the
   messages/sendToOpenAI implementation. That duplicate caused `Identifier ... has
   already been declared` errors which prevented the script from running and the
   products from appearing. The file now keeps the single, original conversationMessages
   + callOpenAIChat flow above. */

// Ensure the "Show More Products" button actually reveals all product cards.
// Beginner-friendly comments included.
document.addEventListener("DOMContentLoaded", function () {
  const productsContainer = document.getElementById("productsContainer");
  const toggleBtn = document.getElementById("toggleProducts");

  if (!productsContainer || !toggleBtn) return;

  // Helper: hide products after the first 6 (index >= 6)
  const hideExtraProducts = () => {
    const cards = productsContainer.querySelectorAll(".product-card");
    cards.forEach((card, idx) => {
      card.style.display = idx >= 6 ? "none" : "flex";
    });
  };

  // Helper: show all products (clear inline display so CSS can manage layout)
  const showAllProducts = () => {
    const cards = productsContainer.querySelectorAll(".product-card");
    cards.forEach((card) => {
      card.style.display = "flex";
    });
  };

  // Initialize: collapse to first 6 on load (if there are products)
  hideExtraProducts();

  // Toggle behaviour when the button is pressed
  toggleBtn.addEventListener("click", function () {
    // Track expanded state on the container via a class
    const expanded = productsContainer.classList.toggle("expanded");

    // Update accessible state on the button and its label text
    toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggleBtn.textContent = expanded
      ? "Show Less Products"
      : "Show More Products";

    // Apply show/hide logic
    if (expanded) {
      showAllProducts();
      // Smoothly bring newly-visible area into view
      productsContainer.scrollIntoView({ behavior: "smooth", block: "end" });
    } else {
      hideExtraProducts();
      productsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
