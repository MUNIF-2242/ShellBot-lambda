// handlers/updateAnswerHandler.js

import EmbeddingService from "../services/embeddingService.js";
import PineconeService from "../services/pineconeService.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const handler = async (event) => {
  try {
    let bodyString = event.body;
    if (event.isBase64Encoded) {
      bodyString = Buffer.from(event.body, "base64").toString("utf-8");
    }

    const body = JSON.parse(bodyString || "{}");
    const { id, updatedText, metadata } = body;

    if (!id || !updatedText || !metadata) {
      throw new Error(
        "Fields 'id', 'updatedText', and 'metadata' are required."
      );
    }

    // Create embedding for updated text
    const embedding = await EmbeddingService.createEmbedding(updatedText);

    // Update metadata fields
    const updatedMetadata = {
      ...metadata,
      text: updatedText,
      addedAt: new Date().toISOString(), // refresh timestamp
      version: Date.now().toString(), // new version
    };

    // Construct new vector to overwrite existing one
    const updatedVector = {
      id,
      values: embedding,
      metadata: updatedMetadata,
    };

    await PineconeService.ensureIndexExists();
    await PineconeService.upsertVectors([updatedVector]);

    return successResponse({
      message: "Vector updated successfully",
      id,
      updatedMetadata,
    });
  } catch (error) {
    console.error("Update Answer Handler Error:", error);
    return errorResponse(error);
  }
};
