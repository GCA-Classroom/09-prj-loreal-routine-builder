const CLOUD_FLARE_WORKER_URL = ""; 
// Optional later. If you add your Worker URL here, the app can use it.
// Leave blank for now, it will use local logic.

const STORAGE_KEYS = {
  selectedProducts: "loreal_selected_products",
  routineData: "loreal_routine_data",
  chatHistory: "loreal_chat_history"
};

let products = [];
let selectedProductIds = [];
let expandedDescriptions = new Set();
let currentRoutine = null;
let chatHistory = [];

const productsGrid = document.getElementById("productsGrid");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedCount = document.getElementById("selectedCount");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const clearSelectionsBtn = document.getElementById("clearSelectionsBtn");
const generateRoutineBtn = document.getElementById("generateRoutineBtn");
const routineOutput = document.getElementById("routineOutput");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  loadState();
  await loadProducts();
  populateCategories();
  renderProducts();
  renderSelectedProducts();
  renderRoutine();
  renderChatHistory();
  attachEvents();
}

function attachEvents() {
  searchInput.addEventListener("input", renderProducts);
  categoryFilter.addEventListener("change", renderProducts);
  clearSelectionsBtn.addEventListener("click", clearSelections);
  generateRoutineBtn.addEventListener("click", handleGenerateRoutine);
  chatForm.addEventListener("submit", handleChatSubmit);
}

function loadState() {
  try {
    selectedProductIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.selectedProducts)) || [];
    currentRoutine = JSON.parse(localStorage.getItem(STORAGE_KEYS.routineData)) || null;
    chatHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.chatHistory)) || [];
  } catch (error) {
    console.error("Error loading local state:", error);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.selectedProducts, JSON.stringify(selectedProductIds));
  localStorage.setItem(STORAGE_KEYS.routineData, JSON.stringify(currentRoutine));
  localStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(chatHistory));
}

async function loadProducts() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error(`Failed to load products.json: ${response.status}`);
    }

    const data = await response.json();
    products = normalizeProducts(data);
  } catch (error) {
    console.error(error);
    products = [];
  }
}

function normalizeProducts(rawProducts) {
  return rawProducts.map((product, index) => {
    const id = product.id || `${product.brand || "brand"}-${product.name || index}-${index}`.toLowerCase().replace(/\s+/g, "-");
    const brand = product.brand || "L’Oréal Brand";
    const name = product.name || "Unnamed Product";
    const image = product.image || product.imageUrl || "img/loreal-logo.png";
    const description = product.description || product.details || product.benefits || "No description available.";
    const category = inferCategory(product);
    const usage = inferUsageType(name, category, description);

    return {
      ...product,
      id,
      brand,
      name,
      image,
      description,
      category,
      usage
    };
  });
}

function inferCategory(product) {
  const raw = `${product.category || ""} ${product.type || ""} ${product.name || ""}`.toLowerCase();

  if (raw.includes("cleanser") || raw.includes("wash") || raw.includes("foam")) return "cleanser";
  if (raw.includes("serum")) return "serum";
  if (raw.includes("retinol")) return "treatment";
  if (raw.includes("treatment")) return "treatment";
  if (raw.includes("moistur")) return "moisturizer";
  if (raw.includes("spf") || raw.includes("sunscreen")) return "spf";
  if (raw.includes("hair")) return "haircare";
  if (raw.includes("makeup")) return "makeup";

  return (product.category || "other").toLowerCase();
}

function inferUsageType(name, category, description) {
  const text = `${name} ${category} ${description}`.toLowerCase();

  if (text.includes("spf") || text.includes("sunscreen")) return "morning";
  if (text.includes("retinol")) return "night";
  return "any";
}

function populateCategories() {
  const categories = [...new Set(products.map(product => product.category))].sort();

  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = toTitleCase(category);
    categoryFilter.appendChild(option);
  });
}

function getFilteredProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  return products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(query) ||
      product.brand.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query);

    const matchesCategory = category === "all" || product.category === category;

    return matchesSearch && matchesCategory;
  });
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();

  if (!filteredProducts.length) {
    productsGrid.innerHTML = `<div class="empty-state">No products match your search.</div>`;
    return;
  }

  productsGrid.innerHTML = filteredProducts
    .map(product => {
      const isSelected = selectedProductIds.includes(product.id);
      const isExpanded = expandedDescriptions.has(product.id);

      return `
        <article class="product-card ${isSelected ? "selected" : ""}">
          <div class="product-image-wrap">
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-image" />
          </div>

          <div class="product-brand">${escapeHtml(product.brand)}</div>
          <div class="product-name">${escapeHtml(product.name)}</div>
          <div class="product-category">${escapeHtml(toTitleCase(product.category))}</div>

          <div class="product-actions">
            <button class="select-btn" data-action="select" data-id="${product.id}" type="button">
              ${isSelected ? "Selected" : "Select"}
            </button>
            <button class="details-btn" data-action="details" data-id="${product.id}" type="button">
              ${isExpanded ? "Hide Details" : "Details"}
            </button>
          </div>

          ${isExpanded ? `<div class="product-description">${escapeHtml(product.description)}</div>` : ""}
        </article>
      `;
    })
    .join("");

  productsGrid.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", handleProductButtonClick);
  });
}

function handleProductButtonClick(event) {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;

  if (action === "select") {
    toggleProductSelection(id);
  }

  if (action === "details") {
    toggleProductDescription(id);
  }
}

function toggleProductSelection(id) {
  if (selectedProductIds.includes(id)) {
    selectedProductIds = selectedProductIds.filter(productId => productId !== id);
  } else {
    selectedProductIds.push(id);
  }

  saveState();
  renderProducts();
  renderSelectedProducts();
}

function toggleProductDescription(id) {
  if (expandedDescriptions.has(id)) {
    expandedDescriptions.delete(id);
  } else {
    expandedDescriptions.add(id);
  }

  renderProducts();
}

function clearSelections() {
  selectedProductIds = [];
  currentRoutine = null;
  chatHistory = [];
  saveState();
  renderProducts();
  renderSelectedProducts();
  renderRoutine();
  renderChatHistory();
}

function renderSelectedProducts() {
  const selectedProducts = getSelectedProducts();
  selectedCount.textContent = `${selectedProducts.length} selected`;

  if (!selectedProducts.length) {
    selectedProductsList.className = "selected-products-list empty-state";
    selectedProductsList.innerHTML = "No products selected yet.";
    return;
  }

  selectedProductsList.className = "selected-products-list";
  selectedProductsList.innerHTML = selectedProducts
    .map(product => `<div class="selected-pill">${escapeHtml(product.brand)} · ${escapeHtml(product.name)}</div>`)
    .join("");
}

function getSelectedProducts() {
  return products.filter(product => selectedProductIds.includes(product.id));
}

async function handleGenerateRoutine() {
  const selectedProducts = getSelectedProducts();

  if (!selectedProducts.length) {
    currentRoutine = {
      morning: [],
      night: [],
      notes: ["Select at least one product before generating a routine."]
    };
    saveState();
    renderRoutine();
    return;
  }

  if (CLOUD_FLARE_WORKER_URL) {
    try {
      const routineFromWorker = await fetchRoutineFromWorker(selectedProducts);
      currentRoutine = routineFromWorker;
    } catch (error) {
      console.error("Worker generation failed, using local logic instead:", error);
      currentRoutine = buildLocalRoutine(selectedProducts);
    }
  } else {
    currentRoutine = buildLocalRoutine(selectedProducts);
  }

  chatHistory = [
    {
      role: "assistant",
      content: "Your routine has been generated. Ask me follow up questions about when to use products, what each one does, or how to simplify the routine."
    }
  ];

  saveState();
  renderRoutine();
  renderChatHistory();
}

async function fetchRoutineFromWorker(selectedProducts) {
  const response = await fetch(CLOUD_FLARE_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      task: "generateRoutine",
      selectedProducts
    })
  });

  if (!response.ok) {
    throw new Error(`Worker request failed: ${response.status}`);
  }

  return await response.json();
}

function buildLocalRoutine(selectedProducts) {
  const morning = [];
  const night = [];
  const notes = [];

  const cleanser = selectedProducts.find(product => product.category === "cleanser");
  const serum = selectedProducts.find(product => product.category === "serum");
  const moisturizer = selectedProducts.find(product => product.category === "moisturizer");
  const spf = selectedProducts.find(product => product.category === "spf");
  const treatment = selectedProducts.find(product => product.category === "treatment");

  if (cleanser) {
    morning.push(stepText("Cleanse", cleanser));
    night.push(stepText("Cleanse", cleanser));
  }

  if (serum) {
    morning.push(stepText("Apply serum", serum));
  }

  if (moisturizer) {
    morning.push(stepText("Moisturize", moisturizer));
    night.push(stepText("Moisturize", moisturizer));
  }

  if (spf) {
    morning.push(stepText("Protect with SPF", spf));
  }

  if (treatment) {
    night.push(stepText("Apply treatment", treatment));
    notes.push("Use retinol and stronger treatments at night unless your dermatologist tells you otherwise.");
  }

  selectedProducts.forEach(product => {
    const alreadyIncluded =
      morning.some(step => step.includes(product.name)) ||
      night.some(step => step.includes(product.name));

    if (!alreadyIncluded) {
      if (product.usage === "night") {
        night.push(stepText("Use product", product));
      } else if (product.usage === "morning") {
        morning.push(stepText("Use product", product));
      } else {
        if (morning.length <= night.length) {
          morning.push(stepText("Use product", product));
        } else {
          night.push(stepText("Use product", product));
        }
      }
    }
  });

  if (!cleanser) {
    notes.push("A cleanser would make the routine feel more complete.");
  }

  if (!moisturizer) {
    notes.push("A moisturizer would help support hydration and barrier care.");
  }

  if (!spf) {
    notes.push("An SPF product would improve your morning routine.");
  }

  if (!morning.length) {
    morning.push("No clear morning routine could be created from the selected products.");
  }

  if (!night.length) {
    night.push("No clear night routine could be created from the selected products.");
  }

  return { morning, night, notes };
}

function stepText(action, product) {
  return `${action} with ${product.brand} ${product.name}.`;
}

function renderRoutine() {
  if (!currentRoutine) {
    routineOutput.innerHTML = `
      <div class="empty-state">
        Your personalized routine will appear here after you click “Generate Routine.”
      </div>
    `;
    return;
  }

  routineOutput.innerHTML = `
    <div class="routine-block">
      <h3>Morning Routine</h3>
      <ol>
        ${currentRoutine.morning.map(step => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>

      <h3>Night Routine</h3>
      <ol>
        ${currentRoutine.night.map(step => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>

      <h3>Notes</h3>
      <ul>
        ${currentRoutine.notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </div>
  `;
}

async function handleChatSubmit(event) {
  event.preventDefault();

  const question = chatInput.value.trim();
  if (!question) return;

  addChatMessage("user", question);
  chatInput.value = "";

  const answer = await buildFollowUpResponse(question);
  addChatMessage("assistant", answer);
}

async function buildFollowUpResponse(question) {
  const selectedProducts = getSelectedProducts();
  const lowerQuestion = question.toLowerCase();

  if (!currentRoutine) {
    return "Generate your routine first, then I can answer questions about how and when to use the selected products.";
  }

  if (CLOUD_FLARE_WORKER_URL) {
    try {
      const response = await fetch(CLOUD_FLARE_WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          task: "followUpChat",
          question,
          selectedProducts,
          routine: currentRoutine,
          chatHistory
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.answer || "I was not able to generate a follow up response from the worker.";
      }
    } catch (error) {
      console.error("Worker follow up failed, using local response:", error);
    }
  }

  const selectedNames = selectedProducts.map(product => `${product.brand} ${product.name}`);

  if (lowerQuestion.includes("why")) {
    return `These products were placed in your routine based on their category and likely use. Selected products currently in context are: ${selectedNames.join(", ")}.`;
  }

  if (lowerQuestion.includes("night")) {
    return `Night routines usually focus on cleansing, treatment, and moisture. In your routine, the night products are: ${currentRoutine.night.join(" ")}`;
  }

  if (lowerQuestion.includes("morning")) {
    return `Morning routines usually focus on cleansing, hydration, and protection. In your routine, the morning products are: ${currentRoutine.morning.join(" ")}`;
  }

  if (lowerQuestion.includes("retinol")) {
    return "Retinol products are usually best used at night, followed by moisturizer. They should also be paired with SPF during the day.";
  }

  if (lowerQuestion.includes("simplify") || lowerQuestion.includes("simple")) {
    return "To simplify this routine, keep the cleanser, one treatment or serum, one moisturizer, and SPF in the morning.";
  }

  if (lowerQuestion.includes("selected") || lowerQuestion.includes("products")) {
    return `You currently have ${selectedProducts.length} selected products: ${selectedNames.join(", ")}.`;
  }

  return `Based on your current routine, I would keep your answer tied to these selected products: ${selectedNames.join(", ")}. Ask me about morning use, night use, simplification, retinol, or why a product was included.`;
}

function addChatMessage(role, content) {
  chatHistory.push({ role, content });
  saveState();
  renderChatHistory();
}

function renderChatHistory() {
  if (!chatHistory.length) {
    chatMessages.innerHTML = `
      <div class="chat-message assistant">
        Hi. Select some products, generate your routine, then ask follow up questions like:
        “Why is this serum in my routine?” or “Can I use retinol at night?”
      </div>
    `;
    return;
  }

  chatMessages.innerHTML = chatHistory
    .map(message => `<div class="chat-message ${message.role}">${escapeHtml(message.content)}</div>`)
    .join("");

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toTitleCase(value) {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
