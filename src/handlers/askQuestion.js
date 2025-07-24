import PineconeService from "../services/pineconeService.js";
import EmbeddingService from "../services/embeddingService.js";

import { successResponse } from "../utils/response.js";

export const handler = async (event, context) => {
  console.log("Lambda handler called:", event.httpMethod, event.path);

  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "Method Not Allowed",
    };
  }

  try {
    const rawBody = event.body;
    const parsedBody =
      typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    const { userQuestion } = parsedBody;

    if (!userQuestion || typeof userQuestion !== "string") {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: "Invalid user question",
      };
    }

    // 1. Create embedding of the user question
    const embedding = await EmbeddingService.createEmbedding(userQuestion);

    // 2. Query Pinecone with the question embedding
    const queryRes = await PineconeService.queryVectors(
      embedding,
      undefined,
      5
    );

    if (!queryRes || queryRes.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: "No relevant context found",
      };
    }

    // 3. Sort matches by relevance score
    const sortedMatches = queryRes.sort((a, b) => b.score - a.score);
    console.log("Sorted matches by relevance:", sortedMatches);

    // 4. Build context from top 3 matches
    const topChunks = sortedMatches.slice(0, 3);
    const context = topChunks
      .map((match) => `(${match.metadata.addedAt}) ${match.metadata.text}`)
      .join("\n\n---\n\n");

    // 5. Generate answer (streaming skipped in Lambda)
    let assistentAnswer = "";
    const stream = EmbeddingService.streamAnswer(context, userQuestion);

    for await (const chunk of stream) {
      assistentAnswer += chunk.toString();
    }

    // 6. Get embedding of the assistant's answer
    const answerEmbedding = await EmbeddingService.createEmbedding(
      assistentAnswer
    );

    // 7. Re-query Pinecone with the assistant answer embedding
    const answerQueryRes = await PineconeService.queryVectors(
      answerEmbedding,
      undefined,
      5
    );
    const sortedAnswerMatches = answerQueryRes.sort(
      (a, b) => b.score - a.score
    );
    const mostRelevantMatch = sortedAnswerMatches[0];

    // 8. Return final metadata
    const successPayload = successResponse({
      userQuestion,
      assistentAnswer,
      source: {
        id: mostRelevantMatch.id,
        docId: mostRelevantMatch.metadata.docId,
        chunkIndex: mostRelevantMatch.metadata.chunkIndex,
        sourceUrl: mostRelevantMatch.metadata.sourceUrl,
        originalText: mostRelevantMatch.metadata.text,
        addedAt: mostRelevantMatch.metadata.addedAt,
        score: mostRelevantMatch.score,
      },
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(successPayload),
    };
  } catch (error) {
    console.error("Lambda error:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "Internal Server Error",
    };
  }
};
