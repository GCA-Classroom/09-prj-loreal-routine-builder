# Project 9: L'Oréal Routine Builder

L'Oréal is expanding what's possible with AI, and now the chatbot is smarter. This project is a product-aware routine builder. Users browse real L'Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can then ask follow-up questions about the routine, just like chatting with a real advisor.

It is plain HTML, CSS, and JavaScript. There are no npm packages, frameworks, or build step.

## Features

- **Browse products** from `products.json`, filtered by category.
- **Live search** by name, brand, or description (150ms debounce). Search and category filters work together.
- **Select products** by clicking a card (or pressing Enter/Space on a focused card). Selected cards get a red border and glow.
- **Selected Products list** with a pill per product, an "×" remove button on each, and a **Clear All** button.
- **Product details**: each card has a "Details" button that expands the description inline (uses `aria-expanded` and `aria-controls`).
- **Saved selections**: choices are stored in `localStorage` (`loreal-selected-products`) and restored on reload. Corrupted data is ignored safely.
- **Generate Routine**: sends the selected products to the AI and shows a step-by-step routine (under 200 words).
- **Follow-up chat with memory**: the whole conversation is sent on every request, so the AI remembers the routine.
- **RTL / LTR toggle** in the header. The layout, pills, and chat bubbles flip, and the choice is saved in `localStorage` (`loreal-direction`).
- **Friendly states**: "Thinking…" bubble while waiting, a message if nothing is selected, and an error message if the service can't be reached.

## Run the project

This project loads `products.json` with `fetch`, so it must be served over HTTP. Opening `index.html` by double-clicking it (`file://`) will not work.

- **VS Code Live Preview**: open the `09-prj-loreal-routine-builder` folder, then right-click `index.html` and choose **Show Preview**.
- **GitHub Codespaces**: open the repo in a codespace and use Live Preview on `index.html`.
- **Python**: run `python -m http.server 8000` inside this folder and visit `http://localhost:8000`.

The chat features need internet access to reach the Cloudflare Worker.

## How it works

```
Browser (script.js)  →  Cloudflare Worker  →  OpenAI
        ← reply ←            ← reply ←
```

1. The user selects products. They are kept in the `selectedProducts` array and saved to `localStorage`.
2. **Generate Routine** adds a user message (a JSON list of the selected products' name, brand, category, and description) to the shared `messages` array.
3. The browser sends `{ messages }` to the Worker at `WORKER_URL`. The Worker calls OpenAI and returns the response.
4. The reply is read from `data.choices[0].message.content`, added to `messages` as an `assistant` turn, and displayed.
5. Follow-up questions are pushed onto the same `messages` array. Because the full array is sent every time, the AI has the routine as context. The server keeps no memory.

The system prompt (set once when the page loads) tells the AI to build routines using only the selected products and to answer only skincare, haircare, makeup, fragrance, and L'Oréal questions. Off-topic questions are handled by this prompt, not by hard-coded keyword blocks.

## Security

- **No API key is in this project.** The OpenAI key lives only as an encrypted secret (`OPENAI_API_KEY`) in the Cloudflare Worker.
- The frontend only calls the Worker URL. Never put an OpenAI key or `api.openai.com` call in `script.js`.
- Product text and AI replies are HTML-escaped before they are displayed.

## Configuration

The Worker URL is set at the top of `script.js`:

```js
const WORKER_URL = "https://lively-hall-d51b.yens537234-cloudflare.workers.dev/";
```

To use your own Worker, deploy the Worker code from Project 8 (`RESOURCE_cloudflare-worker.js`), add the `OPENAI_API_KEY` secret in the Cloudflare dashboard, and replace the URL above.

Note: that Worker limits replies to 300 tokens, so very long answers may be cut off.

## Main files

- `index.html` — page structure: header and RTL toggle, category dropdown and search box, product grid, selected products, and chat.
- `style.css` — layout, product cards, pills, chat bubbles, and RTL-aware styles. Uses the brand colors `#ff003b` (primary) and `#e3a535` (accent).
- `script.js` — product loading and filtering, selection, details, `localStorage`, routine generation, chat, and RTL.
- `products.json` — the product data (`id`, `brand`, `name`, `category`, `image`, `description`).
- `img/loreal-logo.png` — logo used in the header.

## Manual test checklist

1. Choose a category and click cards. They should highlight and appear as pills.
2. Remove products with the pill "×" and with **Clear All**.
3. Click **Details** to expand and collapse a description without selecting the card.
4. Refresh the page and confirm the selection is restored.
5. Click **Generate Routine** with nothing selected to see the friendly message. Then select products and generate a routine.
6. Ask a follow-up about the routine, then an off-topic question to confirm it is declined.
7. Search for a word like `ceramide`, then combine it with a category.
8. Toggle **RTL / LTR**, refresh, and confirm it persists.
