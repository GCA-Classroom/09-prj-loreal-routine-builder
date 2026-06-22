/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");

/* Store selected products and chat history */
let allProducts = [];
let selectedProducts = [];
let chatHistory = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// Example products array (replace with your real data)
const products = [
  {
    id: 1,
    name: "Hydra Genius Moisturizer",
    image: "img/hydra-genius.jpg",
    description:
      "A lightweight moisturizer that delivers instant hydration and a healthy glow.",
  },
  {
    id: 2,
    name: "Revitalift Cleanser",
    image: "img/revitalift-cleanser.jpg",
    description:
      "Gently cleanses and revitalizes skin for a fresh, radiant look.",
  },
  // ...add more products...
];

// Get selected products from localStorage, or start with an empty array
let selectedProductIds =
  JSON.parse(localStorage.getItem("selectedProducts")) || [];

// Helper: Save selected products to localStorage
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProductIds));
}

// Display products in the grid
function displayProducts(productsToShow) {
  const productsContainer = document.getElementById("productsContainer");
  productsContainer.innerHTML = "";

  productsToShow.forEach((product) => {
    // Create the product card
    const card = document.createElement("div");
    card.className = "product-card";
    card.tabIndex = 0;

    // Show "selected" style if chosen
    if (selectedProductIds.includes(product.id)) {
      card.style.border = "2px solid var(--loreal-red)";
    }

    // Card content
    card.innerHTML = `
      <img src="${product.image}" alt="${
      product.name
    }" style="width:100px; height:auto; border-radius:8px; margin-bottom:8px;">
      <h3 style="margin:8px 0 0 0; font-size:1.1rem;">${product.name}</h3>
      <button class="select-btn" style="margin-top:8px; border-radius:6px; border:none; background:var(--loreal-gold); color:var(--loreal-black); padding:4px 10px; cursor:pointer;">
        ${selectedProductIds.includes(product.id) ? "Remove" : "Add"}
      </button>
      <div class="product-description-overlay">
        <h3>Description</h3>
        <p>${product.description}</p>
      </div>
    `;

    // Add event for select/remove button
    const btn = card.querySelector(".select-btn");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (selectedProductIds.includes(product.id)) {
        selectedProductIds = selectedProductIds.filter(
          (id) => id !== product.id
        );
      } else {
        selectedProductIds.push(product.id);
      }
      saveSelectedProducts();
      displayProducts(productsToShow);
      displaySelectedProducts();
    });

    productsContainer.appendChild(card);
  });
}

// Display selected products in the list
function displaySelectedProducts() {
  const selectedList = document.getElementById("selectedProductsList");
  selectedList.innerHTML = "";

  if (selectedProductIds.length === 0) {
    selectedList.innerHTML = "<p>No products selected.</p>";
    document.getElementById("clearSelectionsBtn")?.remove();
    return;
  }

  // Add "Clear All" button
  if (!document.getElementById("clearSelectionsBtn")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "clearSelectionsBtn";
    clearBtn.textContent = "Clear All";
    clearBtn.style =
      "margin-bottom:12px; background:var(--loreal-red); color:white; border:none; border-radius:6px; padding:6px 16px; cursor:pointer;";
    clearBtn.onclick = () => {
      selectedProductIds = [];
      saveSelectedProducts();
      displayProducts(products);
      displaySelectedProducts();
    };
    selectedList.parentNode.insertBefore(clearBtn, selectedList);
  }

  // List each selected product with a remove button
  selectedProductIds.forEach((id) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const item = document.createElement("div");
    item.style = "display:flex;align-items:center;gap:10px;margin-bottom:8px;";
    item.innerHTML = `
      <img src="${product.image}" alt="${product.name}" style="width:40px;height:40px;border-radius:6px;">
      <span>${product.name}</span>
      <button class="remove-selected-btn" style="margin-left:auto;background:var(--loreal-gold);color:var(--loreal-black);border:none;border-radius:4px;padding:2px 10px;cursor:pointer;">Remove</button>
    `;
    item.querySelector(".remove-selected-btn").onclick = () => {
      selectedProductIds = selectedProductIds.filter((pid) => pid !== id);
      saveSelectedProducts();
      displayProducts(products);
      displaySelectedProducts();
    };
    selectedList.appendChild(item);
  });
}

/* Display product cards for a given array of products */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card${
      selectedProducts.some((p) => p.id === product.id) ? " selected" : ""
    }" data-id="${product.id}" tabindex="0">
      <img src="${product.image}" alt="${
        product.name
      }" style="width:100px; height:auto; border-radius:8px; margin-bottom:8px;">
      <h3 style="margin:8px 0 0 0; font-size:1.1rem;">${product.name}</h3>
      <div class="product-description-overlay">
        <h3>Description</h3>
        <p>${product.description}</p>
      </div>
    </div>
  `
    )
    .join("");

  // Add click event to each product card for selection
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = Number(card.getAttribute("data-id"));
      const product = allProducts.find((p) => p.id === id);
      const alreadySelected = selectedProducts.some((p) => p.id === id);
      if (!alreadySelected) {
        selectedProducts.push(product);
      } else {
        // Deselect if already selected
        selectedProducts = selectedProducts.filter((p) => p.id !== id);
      }
      updateSelectedProducts();
      // Refresh grid to update visual selection
      const selectedCategory = categoryFilter.value;
      const filteredProducts = allProducts.filter(
        (product) => product.category === selectedCategory
      );
      displayProducts(filteredProducts);
    });
  });
}

/* Update the Selected Products area */
function updateSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected yet.</div>`;
    return;
  }
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product" data-id="${product.id}" style="display:flex;align-items:center;gap:8px;">
        <img src="${product.image}" alt="${product.name}" style="width:40px;height:40px;object-fit:contain;">
        <span>${product.name}</span>
        <button class="remove-btn" title="Remove" style="background:none;border:none;color:var(--loreal-red);font-size:18px;cursor:pointer;">&times;</button>
      </div>
    `
    )
    .join("");

  // Add remove button functionality
  document
    .querySelectorAll(".selected-product .remove-btn")
    .forEach((btn, idx) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedProducts.splice(idx, 1);
        updateSelectedProducts();
      });
    });
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }
  const selectedCategory = e.target.value;
  // Filter products by category
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory
  );
  displayProducts(filteredProducts);
});

/* Generate routine using OpenAI when button is clicked */
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = `<div style="color:var(--loreal-red);">Please select at least one product first.</div>`;
    return;
  }

  // Show loading message
  chatWindow.innerHTML = `<div>Generating your personalized routine...</div>`;

  // Prepare the system and user messages for OpenAI
  const productList = selectedProducts
    .map((p, i) => `${i + 1}. ${p.brand} ${p.name}`)
    .join("\n");
  const userMessage = `Here are the products I've selected:\n${productList}\n\nPlease create a step-by-step skincare, haircare, or beauty routine using only these products. Explain when and how to use each one.`;

  // Add to chat history
  chatHistory = [
    {
      role: "system",
      content:
        "You are a friendly L'Oréal beauty advisor. Give clear, simple, step-by-step routines using only the user's selected products. If asked follow-up questions, keep your answers easy to understand.",
    },
    { role: "user", content: userMessage },
  ];

  // Call OpenAI API
  const aiReply = await getOpenAIResponse(chatHistory);
  if (aiReply) {
    chatWindow.innerHTML = `<div><strong>Routine:</strong><br>${aiReply.replace(
      /\n/g,
      "<br>"
    )}</div>`;
    // Add assistant reply to chat history
    chatHistory.push({ role: "assistant", content: aiReply });
  } else {
    chatWindow.innerHTML = `<div style="color:var(--loreal-red);">Sorry, there was a problem generating your routine.</div>`;
  }
});

/* Chat form submission handler for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value.trim();
  if (!userInput) return;

  // Show user question in chat
  chatWindow.innerHTML += `<div style="margin-top:12px;"><strong>You:</strong> ${userInput}</div>`;

  // Add user message to chat history
  chatHistory.push({ role: "user", content: userInput });

  // Call OpenAI API with updated chat history
  const aiReply = await getOpenAIResponse(chatHistory);
  if (aiReply) {
    chatWindow.innerHTML += `<div style="margin-top:8px;"><strong>Advisor:</strong> ${aiReply.replace(
      /\n/g,
      "<br>"
    )}</div>`;
    chatWindow.scrollTop = chatWindow.scrollHeight;
    chatHistory.push({ role: "assistant", content: aiReply });
  } else {
    chatWindow.innerHTML += `<div style="color:var(--loreal-red);">Sorry, there was a problem with your question.</div>`;
  }

  chatForm.reset();
});

/* Function to call OpenAI API using fetch and async/await */
/* Function to call OpenAI API using your Cloudflare Worker */
async function getOpenAIResponse(messages) {
  try {
    const response = await fetch("https://yellow-sunset-7be1.ahmadshumail47.workers.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      return data.choices[0].message.content.trim();
    } else {
      console.log("Unexpected OpenAI response:", data);
      return null;
    }
  } catch (err) {
    console.error("Error calling OpenAI proxy:", err);
    return null;
  }
}



/* On page load, fetch all products for later use */
(async () => {
  allProducts = await loadProducts();
  updateSelectedProducts();
})();
