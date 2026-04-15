export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Only POST requests are allowed." }, 405);
    }

    try {
      const body = await request.json();
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const useWebSearch = Boolean(body.useWebSearch);

      if (!messages.length) {
        return jsonResponse({ error: "messages array is required." }, 400);
      }

      if (useWebSearch) {
        const webResult = await callOpenAIResponsesApi(
          messages,
          env.OPENAI_API_KEY,
        );
        return jsonResponse(webResult, 200);
      }

      const chatResult = await callOpenAIChatCompletions(
        messages,
        env.OPENAI_API_KEY,
      );
      return jsonResponse(chatResult, 200);
    } catch (error) {
      return jsonResponse(
        {
          error: "Worker failed to process request.",
          details: error.message,
        },
        500,
      );
    }
  },
};

async function callOpenAIChatCompletions(messages, apiKey) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI chat/completions error: ${errorText}`);
  }

  return response.json();
}

async function callOpenAIResponsesApi(messages, apiKey) {
  const inputText = messages
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: inputText,
      tools: [{ type: "web_search_preview" }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI responses API error: ${errorText}`);
  }

  const data = await response.json();

  const outputText = data.output_text || "";
  const citations = extractCitations(data);

  return {
    outputText,
    citations,
  };
}

function extractCitations(data) {
  const links = [];

  if (!Array.isArray(data.output)) {
    return links;
  }

  for (const outputItem of data.output) {
    if (!Array.isArray(outputItem.content)) {
      continue;
    }

    for (const part of outputItem.content) {
      if (Array.isArray(part.annotations)) {
        for (const annotation of part.annotations) {
          if (annotation.url) {
            links.push(annotation.url);
          }
        }
      }
    }
  }

  return Array.from(new Set(links));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
