/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

const workerUrl = "https://loreal-routine.feliciatruong55.workers.dev";

const messages = [
  {
    role: "system",
    content:
      "You are a L'Oréal skincare and beauty advisor. You'll be given a list of products the user has selected, each with a name, brand, category, and description. Build a clear, step-by-step personalized routine using only those products, explaining the order to use them and why. Keep your answer well-organized and easy to follow.",
  },
];

/* Matches a line that opens a routine step, e.g. "**Step 1: Cleanse**",
   "### Step 2 - Treat" or "1. Step three" */
const stepHeadingPattern =
  /^\s*(?:#{1,6}\s*)?(?:[-*\u2022]\s*)?(?:\d+[.)]\s*)?(?:\*\*\s*)?step\b/i;

/* Escape anything that could be read as HTML, so the AI's reply is only
   ever rendered with the formatting we add ourselves below */
function escapeHtml(text) {
  return text.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]
  );
}

/* Turns *asterisks* into bold text and paints step titles in L'Oreal red */
function formatMessage(text) {
  return escapeHtml(text)
    .split("\n")
    .map((line) => {
      const isStepLine = stepHeadingPattern.test(line);

      // Markdown heading hashes add nothing once the line is styled
      let html = line.replace(/^(\s*)#{1,6}\s*/, "$1");

      // The first bold run on a step line is that step's title
      let isFirstBold = true;
      const bold = (match, inner) => {
        const titleClass = isStepLine && isFirstBold ? ' class="step-title"' : "";
        isFirstBold = false;
        return `<strong${titleClass}>${inner}</strong>`;
      };

      html = html
        .replace(/\*\*([^*]+)\*\*/g, bold)
        .replace(/\*([^*\n]+)\*/g, bold);

      // Step titles written without asterisks still get the accent colour
      if (isStepLine && isFirstBold) {
        html = `<strong class="step-title">${html}</strong>`;
      }

      return html;
    })
    .join("\n");
}

/* Adds one message to the chat window, styled by who sent it */
function addMessage(sender, text) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("chat-message", sender);

  if (sender === "ai") {
    messageEl.innerHTML = formatMessage(text);
  } else {
    messageEl.textContent = text;
  }

  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageEl;
}

/* Shows a status line ("Generating your routine" plus three bouncing dots)
   while we wait on the AI, and hands back the element so the caller can
   remove it once the reply arrives */
function showLoadingDots(text = "Generating your routine") {
  const messageEl = document.createElement("div");
  messageEl.classList.add("chat-message", "ai", "loading");
  messageEl.setAttribute("role", "status");
  messageEl.innerHTML =
    `<span class="loading-text"></span>` +
    `<span class="loading-dots" aria-hidden="true">` +
    `<span></span><span></span><span></span></span>`;
  messageEl.querySelector(".loading-text").textContent = text;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageEl;
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

let allProducts = [];
let selectedProducts = [];

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Runs once when the page loads: fetch all products up front */
async function init() {
  allProducts = await loadProducts();
}
init();

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some((p) => p.id === product.id);

      return `
    <div class="product-card ${isSelected ? "selected" : ""}" data-id="${product.id}">
      <div class="product-card-top">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
          <button
            type="button"
            class="info-btn"
            aria-expanded="false"
            aria-controls="desc-${product.id}"
          >
            <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span class="visually-hidden">Show description</span>
          </button>
        </div>
      </div>
      <div class="description-wrapper" id="desc-${product.id}" aria-hidden="true">
        <p>${product.description}</p>
      </div>
    </div>
  `;
    })
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", (e) => {
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

productsContainer.addEventListener("click", (e) => {
   const infoBtn = e.target.closest(".info-btn");
  if (infoBtn) {
    toggleDescription(infoBtn);
    return;
  }

  const card = e.target.closest(".product-card");
  if (!card) return;

  const id = Number(card.dataset.id);
  toggleProductSelection(id);
});



/* Adds a product to selectedProducts if it isn't already there,
   or removes it if it is. */
function toggleProductSelection(id) {
  const alreadySelected = selectedProducts.some((p) => p.id === id);

  if (alreadySelected) {
    selectedProducts = selectedProducts.filter((p) => p.id !== id);
  } else {
    const product = allProducts.find((p) => p.id === id);
    selectedProducts.push(product);
  }

  updateSelectedProductsUI();
}

/* Shows or hides a product's description, and keeps the button's
aria-expanded state and icon in sync with whether it's open. */
function toggleDescription(button) {
  const wrapperId = button.getAttribute("aria-controls");
  const wrapper = document.getElementById(wrapperId);

  const isOpen = button.getAttribute("aria-expanded") === "true";

  wrapper.classList.toggle("expanded", !isOpen);
  wrapper.setAttribute("aria-hidden", String(isOpen));
  button.setAttribute("aria-expanded", String(!isOpen));

  const icon = button.querySelector("i");
  icon.classList.toggle("fa-circle-info", isOpen);
  icon.classList.toggle("fa-circle-xmark", !isOpen);
}

/* Keeps both the card highlighting and the Selected Products list
   in sync with the current selectedProducts array. */
function updateSelectedProductsUI() {
  // Re-check every card currently on screen and toggle its "selected" class
  document.querySelectorAll(".product-card").forEach((card) => {
    const id = Number(card.dataset.id);
    const isSelected = selectedProducts.some((p) => p.id === id);
    card.classList.toggle("selected", isSelected);
  });

  // Rebuild the Selected Products list
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="placeholder-message">No products selected yet</p>`;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map((product) => `<div class="selected-chip">${product.name}</div>`)
    .join("");
}

async function generateRoutine() {
  // Don't send an empty request if nothing's been picked yet
  if (selectedProducts.length === 0) {
    addMessage("ai", "Please select at least one product first.");
    return;
  }
  const productData = selectedProducts.map((product) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    }));

  // The animated "Generating your routine" status stands in for the user's
  // request in the chat window, so we send the AI the full structured
  // details behind the scenes without echoing anything
  messages.push({
    role: "user",
    content: `Build a personalized routine using these products:\n${JSON.stringify(productData, null, 2)}`,
  });

  // Disable the button while we wait, so it can't be clicked repeatedly
  generateRoutineBtn.disabled = true;
  const loadingMessage = showLoadingDots();

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    loadingMessage.remove();
    addMessage("ai", reply);

  // Remember the AI's routine, so it has context if the user asks a follow-up question about it in the chat below
  messages.push({ role: "assistant", content: reply });
  } catch (error) {
    console.error(error);
    loadingMessage.remove();
    addMessage("ai", "Sorry, something went wrong generating your routine. Please try again.");
  } finally {
    generateRoutineBtn.disabled = false;
  }
}

generateRoutineBtn.addEventListener("click", generateRoutine);

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});
