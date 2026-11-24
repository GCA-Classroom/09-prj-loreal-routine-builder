// The site and API deploy together, so use this Worker's same-origin endpoint.
const WORKER_URL = new URL("/api", window.location.origin).toString();
const SELECTION_STORAGE_KEY = "loreal-routine-selected-products";
const DIRECTION_STORAGE_KEY = "loreal-routine-direction";

const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const resultsStatus = document.getElementById("resultsStatus");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectionEmpty = document.getElementById("selectionEmpty");
const clearSelectionButton = document.getElementById("clearSelection");
const generateButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const chatWindow = document.getElementById("chatWindow");
const appStatus = document.getElementById("appStatus");
const directionToggle = document.getElementById("directionToggle");

let products = [];
let selectedProductIds = loadSavedSelection();
let messages = [];
let routineIsReady = false;
let requestIsRunning = false;

// Keep selection loading defensive so an old or edited browser value can't break the page.
function loadSavedSelection() {
  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(SELECTION_STORAGE_KEY) || "[]",
    );
    return Array.isArray(savedSelection)
      ? savedSelection.filter((id) => Number.isInteger(id))
      : [];
  } catch (error) {
    console.error("Could not read the saved product selection.", error);
    return [];
  }
}

function saveSelection() {
  try {
    localStorage.setItem(
      SELECTION_STORAGE_KEY,
      JSON.stringify(selectedProductIds),
    );
  } catch (error) {
    console.error("Could not save the product selection.", error);
    setStatus("Your browser could not save this selection.", true);
  }
}

function setStatus(message, isError = false) {
  appStatus.textContent = message;
  appStatus.classList.toggle("error", isError);
}

function formatCategory(category) {
  return category
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function populateCategories() {
  const categories = [...new Set(products.map((product) => product.category))]
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second));

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = formatCategory(category);
    categoryFilter.append(option);
  });
}

function getVisibleProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLocaleLowerCase();

  return products.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;
    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description,
    ]
      .join(" ")
      .toLocaleLowerCase();

    return matchesCategory && searchableText.includes(searchTerm);
  });
}

function renderProducts() {
  const visibleProducts = getVisibleProducts();
  productsContainer.replaceChildren();
  resultsStatus.textContent = `${visibleProducts.length} ${
    visibleProducts.length === 1 ? "product" : "products"
  } shown`;

  if (visibleProducts.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "no-results";
    emptyMessage.textContent = "No products match these filters.";
    productsContainer.append(emptyMessage);
    return;
  }

  visibleProducts.forEach((product) => {
    const isSelected = selectedProductIds.includes(product.id);
    const card = document.createElement("article");
    card.className = `product-card${isSelected ? " is-selected" : ""}`;

    const image = document.createElement("img");
    image.className = "product-image";
    image.src = product.image;
    image.alt = "";
    image.loading = "lazy";
    image.onerror = () => {
      image.hidden = true;
    };

    const info = document.createElement("div");
    info.className = "product-info";
    const name = document.createElement("h3");
    name.textContent = product.name;
    const brand = document.createElement("p");
    brand.className = "product-brand";
    brand.textContent = product.brand;
    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = formatCategory(product.category);
    info.append(name, brand, category);

    const actions = document.createElement("div");
    actions.className = "product-actions";
    const selectButton = document.createElement("button");
    selectButton.className = "select-product";
    selectButton.type = "button";
    selectButton.dataset.productId = String(product.id);
    selectButton.textContent = isSelected ? "Selected" : "Add to routine";
    selectButton.setAttribute("aria-pressed", String(isSelected));
    selectButton.setAttribute(
      "aria-label",
      `${isSelected ? "Remove" : "Add"} ${product.name} ${
        isSelected ? "from" : "to"
      } routine`,
    );
    selectButton.addEventListener("click", () => toggleProduct(product.id));

    const descriptionButton = document.createElement("button");
    descriptionButton.className = "description-toggle";
    descriptionButton.type = "button";
    descriptionButton.textContent = "Description";
    descriptionButton.setAttribute("aria-expanded", "false");

    const description = document.createElement("p");
    description.className = "product-description";
    description.id = `product-description-${product.id}`;
    description.textContent = product.description;
    description.hidden = true;
    descriptionButton.setAttribute("aria-controls", description.id);
    descriptionButton.addEventListener("click", () => {
      const isExpanded = descriptionButton.getAttribute("aria-expanded") === "true";
      descriptionButton.setAttribute("aria-expanded", String(!isExpanded));
      descriptionButton.textContent = isExpanded ? "Description" : "Hide description";
      description.hidden = isExpanded;
    });

    actions.append(selectButton, descriptionButton);
    card.append(image, info, actions, description);
    productsContainer.append(card);
  });
}

function getSelectedProducts() {
  return products.filter((product) => selectedProductIds.includes(product.id));
}

function renderSelection() {
  const selectedProducts = getSelectedProducts();
  selectedProductsList.replaceChildren();
  selectionEmpty.hidden = selectedProducts.length > 0;
  clearSelectionButton.disabled = selectedProducts.length === 0;
  generateButton.disabled = selectedProducts.length === 0 || requestIsRunning;

  selectedProducts.forEach((product) => {
    const item = document.createElement("li");
    item.className = "selected-item";
    const name = document.createElement("span");
    name.className = "selected-name";
    name.textContent = `${product.name} — ${product.brand}`;
    const removeButton = document.createElement("button");
    removeButton.className = "remove-product";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${product.name}`);
    removeButton.addEventListener("click", () => toggleProduct(product.id));
    item.append(name, removeButton);
    selectedProductsList.append(item);
  });
}

function toggleProduct(productId) {
  selectedProductIds = selectedProductIds.includes(productId)
    ? selectedProductIds.filter((id) => id !== productId)
    : [...selectedProductIds, productId];
  saveSelection();
  renderSelection();
  renderProducts();
  productsContainer
    .querySelector(`[data-product-id="${productId}"]`)
    ?.focus();
}

function appendChatMessage(role, content) {
  const messageElement = document.createElement("p");
  messageElement.className = `chat-message ${role}`;
  messageElement.textContent = content;
  chatWindow.append(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addMessage(role, content) {
  messages.push({ role, content });
  appendChatMessage(role, content);
}

function setRequestState(isRunning) {
  requestIsRunning = isRunning;
  generateButton.disabled = getSelectedProducts().length === 0 || isRunning;
  userInput.disabled = !routineIsReady || isRunning;
  sendButton.disabled = !routineIsReady || isRunning;
}

async function requestAssistantReply() {
  if (!WORKER_URL) {
    setStatus(
      "Set WORKER_URL in script.js to your deployed Cloudflare Worker URL to enable AI routines.",
      true,
    );
    return false;
  }

  let response;
  try {
    response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
  } catch (error) {
    console.error("Could not contact the routine service.", error);
    setStatus("Could not contact the routine service. Please try again.", true);
    return false;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    console.error("The routine service returned invalid JSON.", error);
    setStatus("The routine service returned an unreadable response.", true);
    return false;
  }

  if (!response.ok) {
    setStatus(
      typeof data.error === "string"
        ? data.error
        : "The routine service could not complete that request.",
      true,
    );
    return false;
  }

  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    setStatus("The routine service returned an empty response.", true);
    return false;
  }

  addMessage("assistant", reply.trim());
  return true;
}

async function generateRoutine() {
  if (getSelectedProducts().length === 0 || requestIsRunning) return;

  if (!WORKER_URL) {
    setStatus(
      "Set WORKER_URL in script.js to your deployed Cloudflare Worker URL to enable AI routines.",
      true,
    );
    return;
  }

  routineIsReady = false;
  messages = [];
  chatWindow.replaceChildren();
  const selectedProducts = getSelectedProducts().map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
  const prompt = `Create a personalized routine using only the selected products below. Briefly explain the order and how to use each product. If useful information such as skin or hair type is missing, mention that the routine is a general starting point.\n\nSelected products (JSON):\n${JSON.stringify(
    selectedProducts,
    null,
    2,
  )}`;

  messages.push({ role: "user", content: prompt });
  appendChatMessage("user", "Please create a routine with my selected products.");
  setRequestState(true);
  setStatus("Creating your routine…");

  const succeeded = await requestAssistantReply();
  if (succeeded) {
    routineIsReady = true;
    setStatus("");
  } else {
    messages = [];
    chatWindow.replaceChildren();
  }
  setRequestState(false);
}

function isRoutineRelatedQuestion(question) {
  const normalizedQuestion = question.toLocaleLowerCase();
  const topicWords =
    /\b(routine|product|skin|skincare|hair|haircare|makeup|cosmetic|fragrance|perfume|scent|cleanser|moistur|serum|spf|sunscreen|foundation|mascara|shampoo|conditioner|lipstick|face|acne|ingredient|application|apply|use|step|order|morning|evening|daily|sensitive|dry|oily|combination|color|colour|texture|brand|this|that|these|those|it|them|your|my|recommend|recommendation|replace|alternative|instead|why|how|when|which|what|can|should|more|less|shorter|longer|explain|repeat|clarify)\b/;
  return topicWords.test(normalizedQuestion);
}

async function sendFollowUp(event) {
  event.preventDefault();
  const question = userInput.value.trim();
  if (!question || !routineIsReady || requestIsRunning) return;

  addMessage("user", question);
  userInput.value = "";

  if (!isRoutineRelatedQuestion(question)) {
    addMessage(
      "assistant",
      "I can help with your routine and skincare, haircare, makeup, or fragrance questions.",
    );
    return;
  }

  setRequestState(true);
  setStatus("Thinking…");
  const succeeded = await requestAssistantReply();
  if (succeeded) setStatus("");
  setRequestState(false);
}

function applyDirection(direction) {
  const isRightToLeft = direction === "rtl";
  document.documentElement.dir = isRightToLeft ? "rtl" : "ltr";
  directionToggle.setAttribute("aria-pressed", String(isRightToLeft));
  directionToggle.textContent = isRightToLeft
    ? "Switch to LTR layout"
    : "Switch to RTL layout";
  try {
    localStorage.setItem(DIRECTION_STORAGE_KEY, isRightToLeft ? "rtl" : "ltr");
  } catch (error) {
    console.error("Could not save the layout direction.", error);
  }
}

async function loadProducts() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error(`Could not load products (${response.status}).`);
    }

    const data = await response.json();
    if (!Array.isArray(data.products)) {
      throw new Error("The product catalog has an unexpected format.");
    }

    products = data.products.filter(
      (product) =>
        Number.isInteger(product.id) &&
        typeof product.name === "string" &&
        typeof product.brand === "string" &&
        typeof product.category === "string" &&
        typeof product.description === "string",
    );
    selectedProductIds = selectedProductIds.filter((id) =>
      products.some((product) => product.id === id),
    );
    saveSelection();
    populateCategories();
    renderProducts();
    renderSelection();
  } catch (error) {
    console.error("Could not load the product catalog.", error);
    productsContainer.textContent =
      "Products could not be loaded. Please reload the page and try again.";
    setStatus("The product catalog could not be loaded.", true);
  }
}

categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);
clearSelectionButton.addEventListener("click", () => {
  selectedProductIds = [];
  saveSelection();
  renderSelection();
  renderProducts();
});
generateButton.addEventListener("click", generateRoutine);
chatForm.addEventListener("submit", sendFollowUp);
directionToggle.addEventListener("click", () => {
  applyDirection(document.documentElement.dir === "rtl" ? "ltr" : "rtl");
});

try {
  const savedDirection = localStorage.getItem(DIRECTION_STORAGE_KEY);
  applyDirection(
    savedDirection === "rtl" || savedDirection === "ltr"
      ? savedDirection
      : /^(ar|fa|he|ur)(-|$)/i.test(navigator.language)
        ? "rtl"
        : "ltr",
  );
} catch (error) {
  console.error("Could not read the saved layout direction.", error);
}

renderSelection();
loadProducts();
