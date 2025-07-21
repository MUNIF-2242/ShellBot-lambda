import { config } from "dotenv";
config(); // Load environment variables
import { CONSTANTS } from "../utils/constants.js";

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

class EmbeddingServiceClass {
  constructor() {
    const awsRegion = process.env.AWS_REGION || "us-east-1";
    this.bedrockClient = new BedrockRuntimeClient({ region: awsRegion });

    this.embeddingModelId = CONSTANTS.EMBEDDING_TEXT_MODEL;
    this.claudeModelId = CONSTANTS.LLM_TEXT_MODEL;
  }

  async createEmbedding(text) {
    const command = new InvokeModelCommand({
      modelId: this.embeddingModelId,
      body: JSON.stringify({ inputText: text }),
      contentType: "application/json",
      accept: "application/json",
    });

    try {
      const response = await this.bedrockClient.send(command);
      const responseBody = await response.body.transformToString();
      const result = JSON.parse(responseBody);
      return result.embedding;
    } catch (error) {
      console.error("Error from Titan Embedding:", error);
      return null;
    }
  }

  async createEmbeddings(texts) {
    return Promise.all(texts.map((text) => this.createEmbedding(text)));
  }
}

const EmbeddingService = new EmbeddingServiceClass();
export default EmbeddingService;
