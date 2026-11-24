# L'Oréal Routine Builder

The website and AI API are deployed together as one Cloudflare Worker. Browse
the sample catalog, search products by category/name/brand/description, save
selections in this browser, and generate an AI routine with follow-up chat.
Selected products are saved in browser `localStorage`; conversation history is
kept in memory while the page is open.

## Deploy the website and Worker

The root `wrangler.toml` configures `worker/index.js` as the Worker entrypoint,
serves the existing site files as static assets, sends `/api` requests to the
backend, and enables the `workers.dev` URL. `.assetsignore` prevents Worker
source, Git metadata, and project documentation from being uploaded as public
site files.

1. Install Node.js, then authenticate Wrangler with `npx wrangler login`.
2. From the repository root, deploy the site and Worker together:

   ```sh
   npx wrangler deploy
   ```

3. After the first deploy creates the Worker, store the OpenAI API key as a
   Cloudflare secret:

   ```sh
   npx wrangler secret put OPENAI_API_KEY
   ```

   Enter the key only at Wrangler's secure prompt. Do not put it in `script.js`,
   `wrangler.toml`, or any committed file. The API returns a configuration
   message until this secret is set.
4. Open the `workers.dev` URL printed by Wrangler. The frontend calls `/api` on
   that same origin, so no endpoint substitution or browser API key is needed.

If the Cloudflare dashboard reports that variables cannot be added to a Worker
with only static assets, deploy from this repository using `npx wrangler deploy`.
The Wrangler config includes a JavaScript Worker entrypoint as well as static
assets, so the deployed service is not an assets-only Worker. `.assetsignore`
also excludes local secret files from public asset uploads.

## Run locally

Use Wrangler so the site and `/api` backend are served by the same local origin:

```sh
npx wrangler dev
```

For AI calls during local development, create a local `.dev.vars` file in the
repository root containing `OPENAI_API_KEY=your-key`. `.dev.vars` is gitignored;
never commit it. The key stays in the Worker environment and is not sent to the
browser.

## CORS and separate frontend hosting

By default the Worker permits requests from its own origin, which is the
`workers.dev` site hosting the frontend. If you host the frontend on a separate
domain, add its exact origin(s), comma-separated, to `ALLOWED_ORIGINS` in
`wrangler.toml`, then redeploy. Origins include scheme and hostname (and a
non-default port if used), but no path or trailing slash. Also set `WORKER_URL`
near the top of `script.js` to
`https://loreal-routine-builder.<your-account-subdomain>.workers.dev/api` so
the separately hosted frontend calls the Worker.

The Worker validates message roles and lengths, ignores client-supplied system
messages, adds its own routine-topic instructions, and calls OpenAI's `gpt-4.1`
using `env.OPENAI_API_KEY`. API keys and upstream error details are not returned
to the browser. The CORS allowlist is not authentication or a complete
abuse-prevention mechanism; monitor usage and configure provider account limits.

## Notes

- Product selections are stored in this browser's `localStorage`; use **Clear
  all** to remove them.
- The direction button switches between left-to-right and right-to-left layouts
  and remembers the choice. Right-to-left browsers default to RTL.
- The current `products.json` is the project sample catalog and can be extended
  with additional product entries.
