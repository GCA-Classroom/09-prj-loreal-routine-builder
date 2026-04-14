// DOM elements
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatArea = document.getElementById("chat-area");

// Replace with your Cloudflare Worker URL
const WORKER_URL = "https://your-worker-name.your-subdomain.workers.dev/";

// Add a message to the chat window
function addMessage(text, sender) {
    const msg = document.createElement("div");
    msg.classList.add("message", sender);
    msg.textContent = text;
    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Handle form submission
form.addEventListener("submit", async function(event) {
    event.preventDefault();

    const userMessage = input.value.trim();
    if (!userMessage) return;

    // Show user message
    addMessage(userMessage, "user");
    input.value = "";

    try {
        // Send message to Cloudflare Worker
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userMessage })
        });

        const data = await response.json();

        if (data.error) {
            addMessage("Error: " + data.error, "assistant");
        } else {
            addMessage(data.reply, "assistant");
        }

    } catch (error) {
        addMessage("Network error. Please try again.", "assistant");
    }
});
