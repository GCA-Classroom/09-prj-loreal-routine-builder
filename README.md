# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Storing your API key securely (local dev)

1. Copy `secrets.example.js` to `secrets.js` in the project root:

```bash
cp secrets.example.js secrets.js
```

2. Edit `secrets.js` and replace the placeholder with your real API key. Example structure is:

```js
window.APP_SECRETS = {
  OPENAI_API_KEY: "your-actual-api-key-here",
};
```

3. `secrets.js` is already listed in `.gitignore`, so it will not be committed (double-check before pushing).

4. In client code you can access the value via `window.APP_SECRETS.OPENAI_API_KEY`.

Warning: For production apps, do not place secret API keys in client-side code — proxy requests through a server or a serverless function.
