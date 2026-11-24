const SYSTEM_MESSAGE = `You are a helpful L'Oréal product and routine advisor. Answer only questions about the user's generated routine, skincare, haircare, makeup, or fragrance. For anything outside those topics, politely say you can only help with those topics. When building a routine, use only the products provided by the user; do not invent product details. Give practical, safe guidance, avoid diagnosis or promises of medical results, and suggest consulting a qualified professional for medical concerns.`;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 12000;
const MAX_TOTAL_LENGTH = 100000;

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function isAllowedOrigin(origin, configuredOrigins, workerOrigin) {
  if (!origin) return false;
  if (origin === workerOrigin) return true;
  if (!configuredOrigins) return false;
  return configuredOrigins
    .split(",")
    .map((value) => value.trim())
    .includes(origin);
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== "/api") {
      return jsonResponse({ error: "Not found." }, 404);
    }

    const origin = request.headers.get("Origin");
    const permitted = isAllowedOrigin(
      origin,
      env.ALLOWED_ORIGINS || "",
      requestUrl.origin,
    );
    const corsHeaders = permitted
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        }
      : {};

    if (request.method === "OPTIONS") {
      return permitted
        ? new Response(null, { status: 204, headers: corsHeaders })
        : jsonResponse(
            { error: "This website is not allowed to use the routine service." },
            403,
          );
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Use POST to request a routine or follow-up." },
        405,
        { Allow: "POST, OPTIONS" },
      );
    }

    if (!permitted) {
      return jsonResponse(
        { error: "This website is not allowed to use the routine service." },
        403,
      );
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return jsonResponse(
        { error: "Send the conversation as JSON." },
        415,
        corsHeaders,
      );
    }

    const contentLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > 500000) {
      return jsonResponse({ error: "The conversation request is too large." }, 413, corsHeaders);
    }

    if (!env.OPENAI_API_KEY) {
      return jsonResponse(
        { error: "The routine service is not configured yet." },
        503,
        corsHeaders,
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400, corsHeaders);
    }

    if (
      !body ||
      !Array.isArray(body.messages) ||
      body.messages.length < 1 ||
      body.messages.length > MAX_MESSAGES
    ) {
      return jsonResponse(
        { error: "Provide a conversation with 1 to 50 messages." },
        400,
        corsHeaders,
      );
    }

    let totalLength = 0;
    const messages = [];
    for (const message of body.messages) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim()
      ) {
        return jsonResponse(
          { error: "Each message must have a user or assistant role and non-empty text." },
          400,
          corsHeaders,
        );
      }

      if (message.content.length > MAX_MESSAGE_LENGTH) {
        return jsonResponse({ error: "A conversation message is too long." }, 413, corsHeaders);
      }

      totalLength += message.content.length;
      messages.push({ role: message.role, content: message.content });
    }

    if (totalLength > MAX_TOTAL_LENGTH) {
      return jsonResponse(
        { error: "The conversation is too long. Start a new routine to continue." },
        413,
        corsHeaders,
      );
    }

    if (messages[messages.length - 1].role !== "user") {
      return jsonResponse(
        { error: "The latest conversation message must be from the user." },
        400,
        corsHeaders,
      );
    }
    if (messages[0].role !== "user") {
      return jsonResponse(
        { error: "The conversation must start with a user message." },
        400,
        corsHeaders,
      );
    }

    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          max_completion_tokens: 1200,
          messages: [{ role: "system", content: SYSTEM_MESSAGE }, ...messages],
        }),
      });
    } catch {
      return jsonResponse(
        { error: "Could not reach the routine service. Please try again." },
        502,
        corsHeaders,
      );
    }

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return jsonResponse(
        {
          error:
            status === 429
              ? "The routine service is busy. Please try again shortly."
              : "The routine service could not complete that request.",
        },
        status,
        corsHeaders,
      );
    }

    let result;
    try {
      result = await upstream.json();
    } catch {
      return jsonResponse(
        { error: "The routine service returned an unreadable response." },
        502,
        corsHeaders,
      );
    }

    if (
      !result ||
      !Array.isArray(result.choices) ||
      !result.choices[0] ||
      !result.choices[0].message ||
      typeof result.choices[0].message.content !== "string"
    ) {
      return jsonResponse(
        { error: "The routine service returned an incomplete response." },
        502,
        corsHeaders,
      );
    }

    return jsonResponse(result, 200, corsHeaders);
  },
};
