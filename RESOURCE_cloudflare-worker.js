export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY;
    const userInput = await request.json();

    let requestBody;

    // Support both 'messages' and 'prompt' formats
    if (userInput.messages) {
      requestBody = {
        model: "gpt-4o",
        messages: userInput.messages,
        max_tokens: 300,
      };
    } else if (userInput.prompt) {
      requestBody = {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful L'Oréal skincare routine advisor.",
          },
          { role: "user", content: userInput.prompt },
        ],
        max_tokens: 300,
      };
    } else {
      return new Response(JSON.stringify({ response: "Invalid input" }), {
        headers: corsHeaders,
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return new Response(
      JSON.stringify({ response: data.choices[0].message.content }),
      {
        headers: corsHeaders,
      }
    );
  },
};
