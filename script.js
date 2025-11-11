/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

/* Array to store selected products */
let selectedProducts = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Update the selected products display */
function updateSelectedProductsList() {
  /* If no products are selected, show a message */
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="no-selection">No products selected yet. Click on products above to add them.</p>
    `;
    return;
  }

  /* Display each selected product as a removable item */
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-item" data-id="${product.id}">
        <img src="${product.image}" alt="${product.name}">
        <div class="selected-item-info">
          <span class="selected-item-name">${product.name}</span>
          <span class="selected-item-brand">${product.brand}</span>
        </div>
        <button class="remove-btn" onclick="removeProduct(${product.id})">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `
    )
    .join("");
}

/* Toggle product selection when a card is clicked */
function toggleProduct(product) {
  /* Check if product is already selected by looking for its id */
  const index = selectedProducts.findIndex((p) => p.id === product.id);

  if (index > -1) {
    /* Product is already selected, so remove it */
    selectedProducts.splice(index, 1);
  } else {
    /* Product is not selected, so add it */
    selectedProducts.push(product);
  }

  /* Update the visual display of selected products */
  updateSelectedProductsList();

  /* Update the visual state of the product card */
  updateProductCardStates();
}

/* Remove a product from the selected list */
function removeProduct(productId) {
  /* Filter out the product with the matching id */
  selectedProducts = selectedProducts.filter((p) => p.id !== productId);

  /* Update the selected products display */
  updateSelectedProductsList();

  /* Update the visual state of product cards */
  updateProductCardStates();
}

/* Update visual states of all product cards to show which are selected */
function updateProductCardStates() {
  /* Get all product cards in the grid */
  const productCards = document.querySelectorAll(".product-card");

  productCards.forEach((card) => {
    const productId = parseInt(card.dataset.id);
    /* Check if this product is in the selected array */
    const isSelected = selectedProducts.some((p) => p.id === productId);

    /* Add or remove the 'selected' class based on selection state */
    if (isSelected) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Toggle the description visibility for a product card */
function toggleDescription(event, productId) {
  /* Stop the click from bubbling up to the card (which would toggle selection) */
  event.stopPropagation();

  /* Find the description element for this specific product */
  const descriptionElement = document.querySelector(
    `[data-description-id="${productId}"]`
  );
  const button = event.currentTarget;
  const icon = button.querySelector("i");

  /* Toggle the 'expanded' class to show/hide the description */
  descriptionElement.classList.toggle("expanded");

  /* Update the button icon based on the state */
  if (descriptionElement.classList.contains("expanded")) {
    icon.className = "fa-solid fa-chevron-up";
    button.setAttribute("aria-expanded", "true");
  } else {
    icon.className = "fa-solid fa-chevron-down";
    button.setAttribute("aria-expanded", "false");
  }
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-id="${
      product.id
    }" onclick='toggleProduct(${JSON.stringify(product).replace(
        /'/g,
        "&apos;"
      )})'>
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button 
          class="description-toggle" 
          onclick="toggleDescription(event, ${product.id})"
          aria-expanded="false"
          aria-label="Toggle product description">
          <i class="fa-solid fa-chevron-down"></i>
          <span>Details</span>
        </button>
      </div>
      <div class="selected-indicator">
        <i class="fa-solid fa-check"></i>
      </div>
      <div class="product-description" data-description-id="${product.id}">
        <p>${product.description}</p>
      </div>
    </div>
  `
    )
    .join("");

  /* After displaying products, update which ones should show as selected */
  updateProductCardStates();
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});

/* Initialize the selected products list on page load */
updateSelectedProductsList();
