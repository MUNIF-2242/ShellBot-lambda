// services/enhanceService.js
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { CONSTANTS } from "../utils/constants.js";

class EnhanceServiceClass {
  constructor() {
    const awsRegion = process.env.AWS_REGION || "us-east-1";
    console.log("Initializing BedrockRuntimeClient with region:", awsRegion);

    this.bedrockClient = new BedrockRuntimeClient({
      region: awsRegion,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID_AWS,
        secretAccessKey: process.env.SECRET_ACCESS_KEY_AWS,
      },
    });

    this.llmModelId = CONSTANTS.LLM_TEXT_MODEL;
  }

  // Main method - returns the complete enhanced text
  async enhanceText(text) {
    let fullResponse = "";

    for await (const chunk of this.enhanceTextStream(text)) {
      fullResponse += chunk;
    }

    return fullResponse;
  }

  // Streaming method - yields text chunks as they come
  async *enhanceTextStream(text) {
    const prompt = `Rephrase the following phrase into a clear, professional question using about 10 words without changing its meaning. Do not include any explanation or prefix in your response.

Phrase:
"${text}"`;

    const messages = [
      {
        role: "user",
        content: [{ text: prompt }],
      },
    ];

    const command = new ConverseStreamCommand({
      modelId: this.llmModelId,
      messages,
      inferenceConfig: {
        temperature: 0.9,
        topP: 0.9,
        maxTokens: 100,
      },
    });

    try {
      const response = await this.bedrockClient.send(command);

      for await (const item of response.stream) {
        if (item.contentBlockDelta?.delta?.text) {
          yield item.contentBlockDelta.delta.text;
        }
      }
    } catch (error) {
      console.error("Error from Bedrock Claude:", error);
      yield "Sorry, I couldn't enhance your text.";
    }
  }
}

const EnhanceService = new EnhanceServiceClass();
export default EnhanceService;
