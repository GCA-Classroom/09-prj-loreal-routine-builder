# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Running it locally

The site is plain static HTML/CSS/JS, so it needs to be served over HTTP (opening `index.html` straight from the file system breaks the `fetch` call to `products.json`).

In this dev container a static server is started automatically on **port 3000** and forwarded to your machine, so the page is available at <http://127.0.0.1:3000>. If the browser says "refused to connect", the server is not running — start it again from the repository root with:

```bash
python3 -m http.server 3000 --bind 0.0.0.0
```

Then open <http://127.0.0.1:3000> (or use the **Ports** view in VS Code and click the forwarded address for port 3000).

Note: use the forwarded port 3000 rather than the random port that the "Open in Browser" / Live Preview button may pick — a random port is not forwarded out of the container, which is what causes `ERR_CONNECTION_REFUSED`.
