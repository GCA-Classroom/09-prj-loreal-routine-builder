# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Features Implemented

- Product cards can be selected and unselected by clicking the card.
- Selected cards are highlighted in the grid.
- Product descriptions can be revealed and hidden with a toggle button.
- Selected products are shown in a live list with per-item Remove actions.
- Selected products are saved in localStorage and restored on page reload.
- Users can clear all selected products with one click.
- Routine generation sends only selected product JSON to the AI endpoint.
- Chat supports follow-up questions and keeps full conversation history.
- Product search filters by name, brand, or keyword and works with category filter.

## Cloudflare Worker Setup

1. Install Wrangler (if not installed):

```bash
npm install -g wrangler
```

2. Authenticate with Cloudflare:

```bash
wrangler login
```

3. Create a Worker project and copy the contents of `cloudflare-worker.js` into your Worker source file.

4. Add your OpenAI API key as a Worker secret:

```bash
wrangler secret put OPENAI_API_KEY
```

5. Deploy your Worker:

```bash
wrangler deploy
```

6. Copy your deployed Worker URL and paste it in `secrets.js`:

```js
window.CLOUDFLARE_WORKER_URL =
  "https://your-worker-name.your-subdomain.workers.dev";
```

## Notes

- Browser code no longer stores an OpenAI key.
- The Worker uses `gpt-4o` for normal chat-completions requests.
- For web-search-enabled responses, the Worker uses the OpenAI Responses API with a web search tool.
