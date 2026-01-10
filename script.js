/* Global variables to store product data and selections */
let allProducts = [];
let selectedProducts = [];

/* Store conversation history for better AI responses */
let conversationHistory = [];
let generatedRoutine = null;

/* Get references to DOM elements - with safety checks */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");

// RTL elements - check if they exist before using them
const rtlToggle = document.getElementById("rtlToggle");
const rtlToggleText = document.getElementById("rtlToggleText");

/* Show initial placeholder until products are loaded */
if (productsContainer) {
  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Loading products...
    </div>
  `;
}

/* Load product data from JSON file */
async function loadProducts() {
  try {
    console.log("Starting to load products from products.json...");
    
    // Check if products container exists
    if (!productsContainer) {
      console.error("Products container not found!");
      return;
    }
    
    const response = await fetch("products.json");
    console.log("Fetch response status:", response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    allProducts = await response.json();
    console.log("Successfully loaded products. Count:", allProducts.length);
    
    if (allProducts.length > 0) {
      console.log("First product example:", allProducts[0]);
      
      // Display all products by default
      displayProducts(allProducts);
    } else {
      console.warn("No products found in the JSON file");
      productsContainer.innerHTML = `
        <div class="no-products-message">
          <p>No products available.</p>
        </div>
      `;
    }
    
  } catch (error) {
    console.error("Error loading products:", error);
    
    if (productsContainer) {
      productsContainer.innerHTML = `
        <div class="error-message">
          <p><strong>Error loading products:</strong></p>
          <p>${error.message}</p>
          <p>Make sure products.json file exists in the same folder.</p>
        </div>
      `;
    }
  }
}

/* Set up all event listeners */
function setupEventListeners() {
  console.log("Setting up event listeners...");
  
  // Category filter change handler
  if (categoryFilter) {
    categoryFilter.addEventListener("change", handleFiltering);
    console.log("Category filter listener added");
  }

  // Search input handler - filter as user types
  if (productSearch) {
    productSearch.addEventListener("input", handleFiltering);
    console.log("Search input listener added");
  }

  // Generate routine button handler
  if (generateRoutineBtn) {
    generateRoutineBtn.addEventListener("click", handleGenerateRoutine);
    console.log("Generate routine button listener added");
  }

  // Chat form submit handler
  if (chatForm) {
    chatForm.addEventListener("submit", handleChatSubmit);
    console.log("Chat form listener added");
  }

  // RTL toggle button handler - only if it exists
  if (rtlToggle) {
    rtlToggle.addEventListener("click", toggleRTL);
    console.log("RTL toggle listener added");
  }
}

/* Handle both category and search filtering together */
function handleFiltering() {
  console.log("handleFiltering called");
  
  if (!categoryFilter || !productSearch) {
    console.error("Filter elements not found!");
    return;
  }
  
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  console.log("Filtering - Category:", selectedCategory, "Search:", searchTerm);
  console.log("Total products available:", allProducts.length);

  // Start with all products
  let filteredProducts = [...allProducts];

  // Apply category filter if a category is selected
  if (selectedCategory !== "") {
    console.log("Applying category filter for:", selectedCategory);
    
    filteredProducts = filteredProducts.filter((product) => {
      const productCategory = product.category.toLowerCase().trim();
      const filterCategory = selectedCategory.toLowerCase().trim();
      
      return productCategory === filterCategory;
    });
    
    console.log("Products after category filter:", filteredProducts.length);
  }

  // Apply search filter if there's a search term
  if (searchTerm !== "") {
    console.log("Applying search filter for:", searchTerm);
    
    filteredProducts = filteredProducts.filter((product) => {
      // Search in product name, brand, and description
      const searchableText = `
        ${product.name.toLowerCase()} 
        ${product.brand.toLowerCase()} 
        ${product.description.toLowerCase()}
      `.toLowerCase();

      return searchableText.includes(searchTerm);
    });
    
    console.log("Products after search filter:", filteredProducts.length);
  }

  // Display the filtered results
  displayProducts(filteredProducts);

  // Show search info if there's a search term or category selected
  showSearchInfo(selectedCategory, searchTerm, filteredProducts.length);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  console.log("displayProducts called with", products.length, "products");
  
  if (!productsContainer) {
    console.error("Products container not found!");
    return;
  }
  
  // Clear the container first
  productsContainer.innerHTML = "";

  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="no-products-message">
        <p>No products found.</p>
        <p>Try selecting a different category or adjusting your search.</p>
      </div>
    `;
    return;
  }

  // Create product cards
  products.forEach((product, index) => {
    console.log(`Creating card ${index + 1}: ${product.name}`);
    const productCard = createProductCard(product);
    productsContainer.appendChild(productCard);
  });
  
  console.log("Finished displaying", products.length, "product cards");
}

/* Create a single product card element */
function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.productId = product.id;

  // Check if this product is already selected
  const isSelected = selectedProducts.some((p) => p.id === product.id);
  if (isSelected) {
    card.classList.add("selected");
  }

  card.innerHTML = `
    <div class="product-brand">${product.brand}</div>
    <h3 class="product-name">${product.name}</h3>
    <div class="product-price">$${product.price}</div>
    <div class="product-category">${product.category}</div>
    <p class="product-description">${product.description}</p>
    <button class="select-btn ${isSelected ? "selected" : ""}" onclick="toggleProductSelection('${product.id}')">
      ${isSelected ? "Remove from Selection" : "Add to Selection"}
    </button>
  `;

  // Add click handler to the entire card (except the button)
  card.addEventListener("click", (event) => {
    // Don't trigger if clicking the button
    if (event.target.classList.contains("select-btn")) {
      return;
    }
    toggleProductSelection(product.id);
  });

  return card;
}

/* Toggle product selection (add or remove from selected list) */
function toggleProductSelection(productId) {
  console.log("toggleProductSelection called for:", productId);
  
  // Find the product in our full product list
  const product = allProducts.find((p) => p.id === productId);
  if (!product) {
    console.error("Product not found:", productId);
    return;
  }

  // Check if product is already selected
  const existingIndex = selectedProducts.findIndex((p) => p.id === productId);

  if (existingIndex >= 0) {
    // Product is selected, so remove it
    selectedProducts.splice(existingIndex, 1);
    console.log("Removed product:", product.name);
  } else {
    // Product is not selected, so add it
    selectedProducts.push(product);
    console.log("Added product:", product.name);
  }

  // Save updated selections to localStorage
  saveSelectedProductsToStorage();

  // Update the visual display
  updateProductCardSelection(productId);
  updateSelectedProductsDisplay();
  updateGenerateButtonState();
}

/* Update the visual state of a product card */
function updateProductCardSelection(productId) {
  const card = document.querySelector(`[data-product-id="${productId}"]`);
  if (!card) return;

  const isSelected = selectedProducts.some((p) => p.id === productId);
  const button = card.querySelector(".select-btn");

  if (isSelected) {
    card.classList.add("selected");
    button.classList.add("selected");
    button.textContent = "Remove from Selection";
  } else {
    card.classList.remove("selected");
    button.classList.remove("selected");
    button.textContent = "Add to Selection";
  }
}

/* Remove a product from the selected list */
function removeFromSelection(productId) {
  const index = selectedProducts.findIndex((p) => p.id === productId);
  if (index >= 0) {
    const removedProduct = selectedProducts[index];
    selectedProducts.splice(index, 1);

    console.log("Removed product from selection:", removedProduct.name);

    // Save updated selections to localStorage
    saveSelectedProductsToStorage();

    updateProductCardSelection(productId);
    updateSelectedProductsDisplay();
    updateGenerateButtonState();
  }
}

/* Clear all selected products and localStorage */
function clearAllSelectedProducts() {
  // Ask user to confirm before clearing
  const confirmed = confirm("Are you sure you want to clear all selected products?");

  if (confirmed) {
    // Clear the selected products array
    selectedProducts = [];

    // Remove from localStorage
    localStorage.removeItem("lorealSelectedProducts");

    // Update all the visual displays
    updateAllProductCardsSelection();
    updateSelectedProductsDisplay();
    updateGenerateButtonState();

    console.log("Cleared all selected products");
  }
}

/* Update all product cards to reflect current selection state */
function updateAllProductCardsSelection() {
  // Find all product cards and update their selection state
  const productCards = document.querySelectorAll(".product-card");

  productCards.forEach((card) => {
    const productId = card.dataset.productId;
    if (productId) {
      updateProductCardSelection(productId);
    }
  });
}

/* Update the selected products list display */
function updateSelectedProductsDisplay() {
  if (!selectedProductsList) return;
  
  selectedProductsList.innerHTML = "";

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      "<p>No products selected yet. Click on products above to add them to your routine.</p>";
    return;
  }

  // Create a container for the selected products and clear button
  const selectedContainer = document.createElement("div");

  // Add each selected product to the container
  selectedProducts.forEach((product) => {
    const item = document.createElement("div");
    item.className = "selected-product-item";
    item.innerHTML = `
      <span class="selected-product-name">${product.brand} - ${product.name}</span>
      <button class="remove-btn" onclick="removeFromSelection('${product.id}')" title="Remove product">
        <i class="fa-solid fa-times"></i>
      </button>
    `;
    selectedContainer.appendChild(item);
  });

  // Add a "Clear All" button if there are selected products
  if (selectedProducts.length > 1) {
    const clearAllBtn = document.createElement("button");
    clearAllBtn.className = "clear-all-btn";
    clearAllBtn.innerHTML =
      '<i class="fa-solid fa-trash"></i> Clear All Products';
    clearAllBtn.onclick = clearAllSelectedProducts;
    selectedContainer.appendChild(clearAllBtn);
  }

  // Add the container to the selected products list
  selectedProductsList.appendChild(selectedContainer);
}

/* Update the state of the generate routine button */
function updateGenerateButtonState() {
  if (!generateRoutineBtn) return;
  
  if (selectedProducts.length > 0) {
    generateRoutineBtn.disabled = false;
    generateRoutineBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine (${selectedProducts.length} products)`;
  } else {
    generateRoutineBtn.disabled = true;
    generateRoutineBtn.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
}

/* Handle generate routine button click */
async function handleGenerateRoutine() {
  // Check if we have selected products
  if (selectedProducts.length === 0) {
    alert("Please select at least one product to generate a routine.");
    return;
  }

  // Disable the button while processing
  generateRoutineBtn.disabled = true;
  generateRoutineBtn.innerHTML = '<div class="loading"></div> Generating Routine...';

  // Create a summary of selected products for display
  const productSummary = selectedProducts
    .map((product) => `${product.brand} ${product.name}`)
    .join(", ");

  // Create the user message for routine generation
  const userMessage = `Generate a personalized beauty routine using: ${productSummary}`;

  // Add user message to chat
  addMessageToChat(userMessage, "user");
  addToConversationHistory("user", userMessage);

  try {
    // Call Cloudflare Worker to generate the routine
    const routine = await generateRoutineWithAI(selectedProducts);

    // Store the generated routine for future reference
    generatedRoutine = routine;

    // Display the AI-generated routine in chat
    addMessageToChat(routine, "ai");
    addToConversationHistory("assistant", routine);
  } catch (error) {
    console.error("Error generating routine:", error);

    // Show error message to user
    const errorMessage = "Sorry, I had trouble generating your routine. Please try again later.";
    addMessageToChat(errorMessage, "ai");
    addToConversationHistory("assistant", errorMessage);
  } finally {
    // Re-enable the button
    updateGenerateButtonState();
  }
}

/* Generate routine using Cloudflare Worker */
async function generateRoutineWithAI(products) {
  // Format the products data for the AI
  const productsContext = products
    .map((product) => {
      return `- ${product.brand} ${product.name} (${product.category}): ${product.description}`;
    })
    .join("\n");

  // Create the system message
  const systemMessage = `You are a professional beauty advisor specializing in L'Oréal brand products. Create personalized beauty routines that are practical, easy to follow, and tailored to the specific products provided.`;

  // Create the user message for routine generation
  const userPrompt = `Please create a personalized beauty routine using these specific products:

${productsContext}

Please provide:
1. A morning routine (if applicable products are selected)
2. An evening routine (if applicable products are selected)
3. Any special tips for using these products together
4. The order of application and why
5. Any additional advice for best results

Make the routine practical and easy to follow.`;

  // Create messages array for Cloudflare Worker
  const messages = [
    {
      role: "system",
      content: systemMessage,
    },
    ...conversationHistory,
    {
      role: "user",
      content: userPrompt,
    },
  ];

  // Make the API call to Cloudflare Worker
  const response = await fetch("https://old-river-ea40.aow39.workers.dev/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  // Check if the API call was successful
  if (!response.ok) {
    throw new Error(`Cloudflare Worker error: ${response.status}`);
  }

  // Parse the response from worker
  const data = await response.json();

  // Extract the AI's response
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    return data.choices[0].message.content;
  } else if (data.content) {
    return data.content;
  } else if (typeof data === "string") {
    return data;
  } else {
    throw new Error("Invalid response format from Cloudflare Worker");
  }
}

/* Handle chat form submission */
async function handleChatSubmit(event) {
  event.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  // Add user message to chat
  addMessageToChat(message, "user");
  addToConversationHistory("user", message);

  // Clear input and disable form while processing
  userInput.value = "";
  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<div class="loading"></div>';

  try {
    // Call Cloudflare Worker for chat response
    const response = await getChatResponse(message);

    // Display AI response
    addMessageToChat(response, "ai");
    addToConversationHistory("assistant", response);
  } catch (error) {
    console.error("Error getting chat response:", error);

    // Show error message
    const errorMessage = "Sorry, I had trouble responding. Please try again.";
    addMessageToChat(errorMessage, "ai");
    addToConversationHistory("assistant", errorMessage);
  } finally {
    // Re-enable the send button
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
  }
}

/* Get chat response from Cloudflare Worker */
async function getChatResponse(userMessage) {
  // Create context about selected products if any
  let productContext = "";
  if (selectedProducts.length > 0) {
    const productsInfo = selectedProducts
      .map((product) => `${product.brand} ${product.name} (${product.category})`)
      .join(", ");
    productContext = `\n\nCurrently selected products: ${productsInfo}`;
  }

  // Add routine context if we have a generated routine
  let routineContext = "";
  if (generatedRoutine) {
    routineContext = `\n\nPreviously generated routine: ${generatedRoutine.substring(0, 200)}...`;
  }

  // Create the system message with context
  const systemMessage = `You are a helpful beauty advisor specializing in L'Oréal brand products. You help users with beauty routines, product recommendations, and skincare/makeup advice. Be friendly, knowledgeable, and concise.${productContext}${routineContext}`;

  // Create messages array
  const messages = [
    {
      role: "system",
      content: systemMessage,
    },
    ...conversationHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];

  // Make API call to Cloudflare Worker
  const response = await fetch("https://old-river-ea40.aow39.workers.dev/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  // Check if API call was successful
  if (!response.ok) {
    throw new Error(`Cloudflare Worker error: ${response.status}`);
  }

  // Parse the response
  const data = await response.json();

  // Extract and return the AI's message
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    return data.choices[0].message.content;
  } else if (data.content) {
    return data.content;
  } else if (typeof data === "string") {
    return data;
  } else {
    throw new Error("Invalid response format from Cloudflare Worker");
  }
}

/* Add message to conversation history */
function addToConversationHistory(role, content) {
  // Add the message to our conversation history array
  conversationHistory.push({
    role: role, // 'user' or 'assistant'
    content: content,
  });

  // Keep only the last 20 messages to stay within token limits
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
  }
}

/* Add a message to the chat window */
function addMessageToChat(message, sender) {
  if (!chatWindow) return;
  
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${sender}-message`;
  messageDiv.textContent = message;

  chatWindow.appendChild(messageDiv);

  // Scroll to bottom of chat
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Show information about search results */
function showSearchInfo(category, searchTerm, resultCount) {
  // Remove any existing search info
  const existingInfo = document.querySelector(".search-info");
  if (existingInfo) {
    existingInfo.remove();
  }

  // Only show info if there's an active filter or search
  if (category === "" && searchTerm === "") {
    return;
  }

  // Create search info element
  const searchInfo = document.createElement("div");
  searchInfo.className = "search-info";

  let infoText = `Showing ${resultCount} products`;

  if (category && searchTerm) {
    infoText += ` in "${category}" category matching "${searchTerm}"`;
  } else if (category) {
    infoText += ` in "${category}" category`;
  } else if (searchTerm) {
    infoText += ` matching "${searchTerm}"`;
  }

  searchInfo.textContent = infoText;

  // Insert the info before the products container
  if (productsContainer && productsContainer.parentNode) {
    productsContainer.parentNode.insertBefore(searchInfo, productsContainer);
  }
}

/* Save selected products to localStorage */
function saveSelectedProductsToStorage() {
  try {
    const productsJSON = JSON.stringify(selectedProducts);
    localStorage.setItem("lorealSelectedProducts", productsJSON);
    console.log("Saved products to localStorage:", selectedProducts.length);
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

/* Load selected products from localStorage */
function loadSelectedProductsFromStorage() {
  try {
    const savedProductsJSON = localStorage.getItem("lorealSelectedProducts");

    if (savedProductsJSON) {
      selectedProducts = JSON.parse(savedProductsJSON);
      console.log("Loaded products from localStorage:", selectedProducts.length);
    } else {
      selectedProducts = [];
      console.log("No saved products found in localStorage");
    }
  } catch (error) {
    console.error("Error loading from localStorage:", error);
    selectedProducts = [];
  }
}

/* Toggle RTL/LTR direction */
function toggleRTL() {
  if (!rtlToggle || !rtlToggleText) {
    console.log("RTL elements not found");
    return;
  }
  
  const html = document.documentElement;
  const isRTL = html.getAttribute('dir') === 'rtl';
  
  if (isRTL) {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'en');
    rtlToggleText.textContent = 'عربي';
  } else {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
    rtlToggleText.textContent = 'English';
  }
  
  localStorage.setItem('textDirection', html.getAttribute('dir'));
}

/* Load saved text direction preference */
function loadTextDirectionPreference() {
  try {
    const savedDirection = localStorage.getItem('textDirection');
    if (savedDirection === 'rtl' && rtlToggleText) {
      const html = document.documentElement;
      html.setAttribute('dir', 'rtl');
      html.setAttribute('lang', 'ar');
      rtlToggleText.textContent = 'English';
    }
  } catch (error) {
    console.error('Error loading text direction preference:', error);
  }
}

/* Initialize the application when page loads */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded, starting initialization...");
  
  // Check if required elements exist
  console.log("Products container found:", !!productsContainer);
  console.log("Category filter found:", !!categoryFilter);
  console.log("Product search found:", !!productSearch);
  
  // Load text direction preference first
  loadTextDirectionPreference();
  
  // Load saved products from localStorage
  loadSelectedProductsFromStorage();

  // Load products from JSON file
  await loadProducts();
  
  // Set up event listeners
  setupEventListeners();
  
  // Update displays
  updateSelectedProductsDisplay();
  updateGenerateButtonState();
  
  console.log("Initialization complete");
});

/* Make functions globally available for onclick handlers */
window.toggleProductSelection = toggleProductSelection;
window.removeFromSelection = removeFromSelection;
window.clearAllSelectedProducts = clearAllSelectedProducts;
messageDiv.textContent = message;

/* NEW: Type message character by character */
function typeMessage(element, message) {
  return new Promise((resolve) => {
    let index = 0;
    const typingSpeed = 30; // milliseconds between characters

    function typeCharacter() {
      if (index < message.length) {
        const currentText = message.substring(0, index + 1);
        element.innerHTML =
          currentText + '<span class="typing-cursor">|</span>';
        index++;

        // Scroll to bottom during typing
        chatWindow.scrollTop = chatWindow.scrollHeight;

        setTimeout(typeCharacter, typingSpeed);
      } else {
        resolve();
      }
    }

    typeCharacter();
  });
}

/* UPDATED: Add a message to the chat window with enhanced effects */
function addMessageToChat(message, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${sender}-message`;
  messageDiv.textContent = message;

  chatWindow.appendChild(messageDiv);

  // Add entrance animation
  setTimeout(() => {
    messageDiv.classList.add("message-animate-in");
  }, 10);

  // Scroll to bottom with smooth behavior
  chatWindow.scrollTo({
    top: chatWindow.scrollHeight,
    behavior: "smooth",
  });
}

/* NEW: Add pulse effect to buttons when they become active */
function addButtonPulseEffect(button) {
  button.classList.add("pulse-effect");
  setTimeout(() => {
    button.classList.remove("pulse-effect");
  }, 1000);
}

/* NEW: Add success animation to product selection */
function addProductSelectionAnimation(productId, isSelected) {
  const card = document.querySelector(`[data-product-id="${productId}"]`);
  if (!card) return;

  if (isSelected) {
    // Add selection animation
    card.classList.add("product-selected-animation");
    setTimeout(() => {
      card.classList.remove("product-selected-animation");
    }, 600);
  } else {
    // Add deselection animation
    card.classList.add("product-deselected-animation");
    setTimeout(() => {
      card.classList.remove("product-deselected-animation");
    }, 400);
  }
}

/* UPDATED: Toggle product selection with enhanced animations */
function toggleProductSelection(productId) {
  // Find the product in our full product list
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  // Check if product is already selected
  const existingIndex = selectedProducts.findIndex((p) => p.id === productId);
  const wasSelected = existingIndex >= 0;

  if (existingIndex >= 0) {
    // Product is selected, so remove it
    selectedProducts.splice(existingIndex, 1);
    console.log("Removed product:", product.name);
  } else {
    // Product is not selected, so add it
    selectedProducts.push(product);
    console.log("Added product:", product.name);
  }

  // Add selection animation
  addProductSelectionAnimation(productId, !wasSelected);

  // Save updated selections to localStorage
  saveSelectedProductsToStorage();

  // Update the visual display
  updateProductCardSelection(productId);
  updateSelectedProductsDisplay();
  updateGenerateButtonState();
}

/* Toggle RTL/LTR direction */
function toggleRTL() {
  const html = document.documentElement;
  const isRTL = html.getAttribute("dir") === "rtl";

  if (isRTL) {
    // Switch to LTR
    html.setAttribute("dir", "ltr");
    html.setAttribute("lang", "en");
    rtlToggleText.textContent = "عربي";

    // Update placeholders and labels for LTR
    updateInterfaceText("ltr");

    console.log("Switched to LTR mode");
  } else {
    // Switch to RTL
    html.setAttribute("dir", "rtl");
    html.setAttribute("lang", "ar");
    rtlToggleText.textContent = "English";

    // Update placeholders and labels for RTL
    updateInterfaceText("rtl");

    console.log("Switched to RTL mode");
  }

  // Save the direction preference to localStorage
  localStorage.setItem("textDirection", html.getAttribute("dir"));

  // Scroll chat to bottom after direction change
  setTimeout(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }, 100);
}

/* NEW: Update interface text based on direction */
function updateInterfaceText(direction) {
  if (direction === "rtl") {
    // Update Arabic text
    productSearch.placeholder =
      "البحث عن المنتجات بالاسم أو العلامة التجارية...";
    userInput.placeholder = "اسألني عن المنتجات أو الروتين...";

    // Update category filter if needed
    const firstOption = categoryFilter.querySelector("option[disabled]");
    if (firstOption) {
      firstOption.textContent = "اختر فئة";
    }
  } else {
    // Update English text
    productSearch.placeholder = "Search products by name or brand...";
    userInput.placeholder = "Ask me about products or routines…";

    // Update category filter
    const firstOption = categoryFilter.querySelector("option[disabled]");
    if (firstOption) {
      firstOption.textContent = "Choose a Category";
    }
  }
}

/* NEW: Load saved text direction preference */
function loadTextDirectionPreference() {
  try {
    const savedDirection = localStorage.getItem("textDirection");
    if (savedDirection === "rtl") {
      const html = document.documentElement;
      html.setAttribute("dir", "rtl");
      html.setAttribute("lang", "ar");
      rtlToggleText.textContent = "English";
      updateInterfaceText("rtl");
      console.log("Loaded RTL direction from localStorage");
    }
  } catch (error) {
    console.error("Error loading text direction preference:", error);
  }
}

// Load products when page loads - UPDATED
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded, starting initialization...");

  // Load text direction preference first
  loadTextDirectionPreference();

  // Load saved products from localStorage first
  loadSelectedProductsFromStorage();

  // Load products from JSON file
  await loadProducts();

  // Set up event listeners
  setupEventListeners();

  // Update displays
  updateSelectedProductsDisplay();
  updateGenerateButtonState();

  console.log("Initialization complete");
});

// Make functions globally available for onclick handlers
window.toggleProductSelection = toggleProductSelection;
window.removeFromSelection = removeFromSelection;
window.clearAllSelectedProducts = clearAllSelectedProducts;
