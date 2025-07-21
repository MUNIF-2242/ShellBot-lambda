// functions/enhance.js

import EnhanceService from "../services/enhanceService.js";
import { successResponse, errorResponse } from "../utils/response.js";

export const handler = async (event) => {
  try {
    let bodyString = event.body;

    // Decode base64 if necessary
    if (event.isBase64Encoded) {
      bodyString = Buffer.from(event.body, "base64").toString("utf-8");
    }

    const { text } = JSON.parse(bodyString || "{}");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Please provide non-empty 'text' to enhance.");
    }

    const enhancedText = await EnhanceService.enhanceText(text);

    return successResponse({
      original: text,
      enhanced: enhancedText,
    });
  } catch (error) {
    console.error("Enhance handler error:", error);
    return errorResponse(error);
  }
};
