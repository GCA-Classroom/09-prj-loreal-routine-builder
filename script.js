
/* =========================================
   L'ORÉAL SMART ROUTINE & PRODUCT ADVISOR
   COMPLETE JAVASCRIPT
   ========================================= */

/* =========================================
   DOM ELEMENTS
   ========================================= */

const categoryFilter =
  document.getElementById("categoryFilter");

const productSearch =
  document.getElementById("productSearch");

const productsContainer =
  document.getElementById("productsContainer");

const selectedProductsList =
  document.getElementById("selectedProductsList");

const selectedCount =
  document.getElementById("selectedCount");

const clearSelections =
  document.getElementById("clearSelections");

const generateRoutineBtn =
  document.getElementById("generateRoutine");

const chatForm =
  document.getElementById("chatForm");

const chatWindow =
  document.getElementById("chatWindow");

const userInput =
  document.getElementById("userInput");

const sendBtn =
  document.getElementById("sendBtn");

const directionToggle =
  document.getElementById("directionToggle");

/* =========================================
   CONFIGURATION
   ========================================= */

// Cloudflare Worker API endpoint.
// Your API key stays securely in Cloudflare.
const API_URL = "/api/chat";

const STORAGE_KEY = "lorealSelectedProducts";
const DIRECTION_KEY = "lorealDirection";

/* =========================================
   APP STATE
   ========================================= */

let allProducts = [];
let selectedProducts = [];
let conversationHistory = [];
let routineGenerated = false;
let isLoading = false;

/* =========================================
   PRODUCT IDENTIFICATION
   ========================================= */

function getProductId(product) {
  if (product.id !== undefined && product.id !== null) {
    return String(product.id);
  }

  return JSON.stringify([
    product.name,
    product.brand,
    product.category
  ]);
}

function isSelected(product) {
  return selectedProducts.some(
    item => getProductId(item) === getProductId(product)
  );
}

/* =========================================
   LOAD PRODUCTS
   ========================================= */

async function loadProducts() {
  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Loading beauty products...
    </div>
  `;

  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error("Could not load products.");
    }

    const data = await response.json();

    if (!Array.isArray(data.products)) {
      throw new Error("Invalid product data.");
    }

    allProducts = data.products;

    restoreSelections();
    filterProducts();

  } catch (error) {
    console.error("Product loading error:", error);

    productsContainer.textContent =
      "Unable to load products. Please refresh the page.";
  }
}

/* =========================================
   DISPLAY PRODUCT CARDS
   ========================================= */

function displayProducts(products) {
  productsContainer.replaceChildren();

  if (products.length === 0) {
    const message = document.createElement("p");
    message.className = "placeholder-message";

    message.textContent =
      "No products found. Try another category or search term.";

    productsContainer.appendChild(message);
    return;
  }

  products.forEach(product => {
    const selected = isSelected(product);

    const card = document.createElement("div");
    card.className = "product-card";

    if (selected) {
      card.classList.add("selected");
    }

    // PRODUCT IMAGE
    const image = document.createElement("img");
    image.src = product.image || "";
    image.alt = product.name || "Beauty product";
    image.loading = "lazy";

    // PRODUCT INFORMATION
    const info = document.createElement("div");
    info.className = "product-info";

    const name = document.createElement("h3");
    name.textContent = product.name || "Unnamed Product";

    const brand = document.createElement("p");
    brand.textContent = product.brand || "L'Oréal";

    // PRODUCT DESCRIPTION
    const description = document.createElement("p");
    description.className = "product-description";

    description.textContent =
      product.description || "No description available.";

    description.hidden = true;

    // VIEW DETAILS BUTTON
    const detailsBtn = document.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.className = "details-btn";
    detailsBtn.textContent = "View Details";

    detailsBtn.setAttribute("aria-expanded", "false");

    detailsBtn.addEventListener("click", event => {
      event.stopPropagation();

      description.hidden = !description.hidden;

      detailsBtn.textContent = description.hidden
        ? "View Details"
        : "Hide Details";

      detailsBtn.setAttribute(
        "aria-expanded",
        String(!description.hidden)
      );
    });

    // SELECT PRODUCT BUTTON
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "select-product-btn";

    selectBtn.textContent = selected
      ? "✓ Selected"
      : "+ Add Product";

    selectBtn.setAttribute(
      "aria-pressed",
      String(selected)
    );

    selectBtn.disabled = isLoading;

    selectBtn.addEventListener("click", event => {
      event.stopPropagation();
      toggleProduct(product);
    });

    info.append(
      name,
      brand,
      detailsBtn,
      description,
      selectBtn
    );

    card.append(image, info);

    // CLICK CARD TO SELECT
    card.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      toggleProduct(product);
    });

    productsContainer.appendChild(card);
  });
}

/* =========================================
   LIVE PRODUCT SEARCH + CATEGORY FILTER
   EXTRA CREDIT: 10 POINTS
   ========================================= */

function filterProducts() {
  const category = categoryFilter.value
    .toLowerCase()
    .trim();

  const searchTerm = productSearch.value
    .toLowerCase()
    .trim();

  const filteredProducts = allProducts.filter(product => {
    // CATEGORY MATCH
    const matchesCategory =
      !category ||
      String(product.category || "")
        .toLowerCase()
        .trim() === category;

    // SEARCH NAME, BRAND, CATEGORY & DESCRIPTION
    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      searchableText.includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

// UPDATE PRODUCTS WHEN CATEGORY CHANGES
categoryFilter.addEventListener("change", filterProducts);

// UPDATE PRODUCTS AS USER TYPES
productSearch.addEventListener("input", filterProducts);

/* =========================================
   SELECT / UNSELECT PRODUCTS
   ========================================= */

function toggleProduct(product) {
  if (isLoading) return;

  const productId = getProductId(product);

  if (isSelected(product)) {
    selectedProducts = selectedProducts.filter(
      item => getProductId(item) !== productId
    );
  } else {
    selectedProducts.push(product);
  }

  saveSelections();
  updateSelectedProducts();
  filterProducts();
}

/* =========================================
   UPDATE SELECTED PRODUCTS LIST
   ========================================= */

function updateSelectedProducts() {
  selectedProductsList.replaceChildren();

  if (selectedCount) {
    selectedCount.textContent = selectedProducts.length;
  }

  if (clearSelections) {
    clearSelections.disabled =
      isLoading || selectedProducts.length === 0;
  }

  if (selectedProducts.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-selection";

    message.textContent =
      "No products selected yet. Explore the collection to get started!";

    selectedProductsList.appendChild(message);

    generateRoutineBtn.disabled = true;
    return;
  }

  generateRoutineBtn.disabled = isLoading;

  selectedProducts.forEach(product => {
    const item = document.createElement("div");
    item.className = "selected-product-item";

    const name = document.createElement("span");
    name.textContent = product.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-product-btn";
    removeBtn.textContent = "×";

    removeBtn.disabled = isLoading;

    removeBtn.setAttribute(
      "aria-label",
      `Remove ${product.name}`
    );

    removeBtn.addEventListener("click", () => {
      toggleProduct(product);
    });

    item.append(name, removeBtn);
    selectedProductsList.appendChild(item);
  });
}

/* =========================================
   LOCAL STORAGE
   ========================================= */

function saveSelections() {
  try {
    const ids = selectedProducts.map(getProductId);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ids)
    );
  } catch (error) {
    console.warn("Unable to save selections:", error);
  }
}

function restoreSelections() {
  try {
    const savedIds = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (Array.isArray(savedIds)) {
      selectedProducts = allProducts.filter(
        product => savedIds.includes(getProductId(product))
      );
    } else {
      selectedProducts = [];
    }

  } catch (error) {
    console.warn("Unable to restore selections:", error);
    selectedProducts = [];
  }

  updateSelectedProducts();
}

// CLEAR ALL PRODUCTS
if (clearSelections) {
  clearSelections.addEventListener("click", () => {
    if (isLoading) return;

    selectedProducts = [];

    saveSelections();
    updateSelectedProducts();
    filterProducts();
  });
}

/* =========================================
   RTL LANGUAGE SUPPORT
   EXTRA CREDIT: 5 POINTS
   ========================================= */

function setDirection(direction) {
  const validDirection =
    direction === "rtl" ? "rtl" : "ltr";

  document.documentElement.setAttribute(
    "dir",
    validDirection
  );

  directionToggle.value = validDirection;

  try {
    localStorage.setItem(
      DIRECTION_KEY,
      validDirection
    );
  } catch (error) {
    console.warn("Unable to save layout direction:", error);
  }
}

directionToggle.addEventListener("change", () => {
  setDirection(directionToggle.value);
});

let savedDirection = "ltr";

try {
  savedDirection =
    localStorage.getItem(DIRECTION_KEY) || "ltr";
} catch (error) {
  console.warn("Unable to load layout direction:", error);
}

setDirection(savedDirection);

/* =========================================
   CHAT MESSAGES
   ========================================= */

function addChatMessage(role, content) {
  const message = document.createElement("div");

  message.className = role === "user"
    ? "chat-message user-message"
    : "chat-message bot-message";

  message.textContent = content;

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return message;
}

/* =========================================
   WEB SEARCH SOURCE LINKS
   EXTRA CREDIT: 10 POINTS
   ========================================= */

function displaySources(messageElement, sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return;
  }

  const container = document.createElement("div");
  container.className = "chat-sources";

  const heading = document.createElement("strong");
  heading.textContent = "Sources:";

  container.appendChild(heading);

  let validCount = 0;

  sources.forEach(source => {
    if (!source || !source.url) return;

    try {
      const url = new URL(source.url);

      if (!["https:", "http:"].includes(url.protocol)) {
        return;
      }

      const link = document.createElement("a");

      link.href = url.href;
      link.textContent =
        source.title || url.hostname;

      link.target = "_blank";
      link.rel = "noopener noreferrer";

      container.appendChild(link);
      validCount++;

    } catch (error) {
      console.warn("Invalid citation URL:", error);
    }
  });

  if (validCount > 0) {
    messageElement.appendChild(container);
  }
}

/* =========================================
   LOADING STATE
   ========================================= */

function setLoading(loading) {
  isLoading = loading;

  userInput.disabled = loading;
  sendBtn.disabled = loading;
  categoryFilter.disabled = loading;
  productSearch.disabled = loading;

  updateSelectedProducts();
  filterProducts();
}

/* =========================================
   CLOUDFLARE AI API CONNECTION
   ========================================= */

async function sendToOpenAI(messages) {
  // Sends messages to your Cloudflare Worker.
  // The secret API key is never exposed here.

  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({ messages })
  });

  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;

    try {
      const errorData = await response.json();

      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Keep the default error message.
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (
    typeof data.reply !== "string" ||
    !data.reply.trim()
  ) {
    throw new Error("Invalid AI response.");
  }

  return {
    reply: data.reply,
    sources: Array.isArray(data.sources)
      ? data.sources
      : []
  };
}

/* =========================================
   GENERATE PERSONALIZED ROUTINE
   ========================================= */

generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0 || isLoading) {
    return;
  }

  const productData = selectedProducts.map(product => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description || ""
  }));

  const prompt = `
You are a friendly L'Oréal Beauty Advisor.

Create a personalized beauty routine using ONLY
the selected products below.

SELECTED PRODUCTS:
${JSON.stringify(productData, null, 2)}

INSTRUCTIONS:
- Use ONLY the selected products.
- Do not add products that were not selected.
- Organize products in the correct application order.
- Explain why each product is included.
- Separate skincare, haircare, and makeup if needed.
- Include morning and evening steps when appropriate.
- Avoid assumptions about skin or hair type.
- Ask a helpful follow-up question if necessary.
- Keep the response clear and professional.

If current product information is useful,
use available web search tools and cite sources.
`;

  addChatMessage(
    "user",
    "Generate my personalized beauty routine"
  );

  const loadingMessage = addChatMessage(
    "assistant",
    "✨ Creating your personalized beauty routine..."
  );

  setLoading(true);

  try {
    // A new routine begins a new conversation.
    const newHistory = [
      {
        role: "user",
        content: prompt
      }
    ];

    const result = await sendToOpenAI(newHistory);

    loadingMessage.textContent = result.reply;

    displaySources(
      loadingMessage,
      result.sources
    );

    conversationHistory = [
      ...newHistory,
      {
        role: "assistant",
        content: result.reply
      }
    ];

    routineGenerated = true;

  } catch (error) {
    console.error("Routine generation error:", error);

    loadingMessage.textContent =
      "Sorry! I couldn't create your routine. Please try again.";

  } finally {
    setLoading(false);
  }
});

/* =========================================
   FOLLOW-UP CHAT QUESTIONS
   ========================================= */

chatForm.addEventListener("submit", async event => {
  event.preventDefault();

  const question = userInput.value.trim();

  if (!question || isLoading) {
    return;
  }

  if (!routineGenerated) {
    addChatMessage(
      "assistant",
      "Please generate your personalized routine first, then ask me a question!"
    );
    return;
  }

  userInput.value = "";

  addChatMessage("user", question);

  const loadingMessage = addChatMessage(
    "assistant",
    "✨ Thinking about your question..."
  );

  const nextHistory = [
    ...conversationHistory,
    {
      role: "user",
      content: question
    }
  ];

  setLoading(true);

  try {
    const result = await sendToOpenAI(nextHistory);

    loadingMessage.textContent = result.reply;

    displaySources(
      loadingMessage,
      result.sources
    );

    conversationHistory = [
      ...nextHistory,
      {
        role: "assistant",
        content: result.reply
      }
    ];

  } catch (error) {
    console.error("Chat error:", error);

    loadingMessage.textContent =
      "Sorry, something went wrong. Please try again.";

  } finally {
    setLoading(false);
    userInput.focus();
  }
});

/* =========================================
   INITIALIZE APP
   ========================================= */

loadProducts();
