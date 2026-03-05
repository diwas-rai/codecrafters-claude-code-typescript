import OpenAI from "openai";
import * as fs from "fs";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "user", content: prompt },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages,
      tools: [
        {
          type: "function",
          function: {
            name: "Read",
            description: "Read and return the contents of a file",
            parameters: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description: "The path to the file to read",
                },
              },
              required: ["file_path"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "Write",
            description: "Write content to a file",
            parameters: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description: "The path to the file to write to",
                },
                content: {
                  type: "string",
                  description: "The content to write to the file",
                },
              },
              required: ["file_path", "content"],
            },
          },
        },
      ],
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    messages.push(response.choices[0].message);
    const toolCalls = response.choices[0].message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      console.log(response.choices[0].message.content);
      return;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type === "function") {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        switch (functionName) {
          case "Read": {
            const filePath = functionArgs.file_path;
            const content = fs.readFileSync(filePath, "utf8");
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: content,
            });
            break;
          }
          case "Write":
            const filePath = functionArgs.file_path;
            const content = functionArgs.content;
            fs.writeFileSync(filePath, content);
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: content,
            });
            break;
          default:
            break;
        }
      }
    }
  }
}

main();
