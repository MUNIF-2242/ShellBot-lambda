import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import PineconeService from "../services/pineconeService.js";
import EmbeddingService from "../services/embeddingService.js";
import PDFService from "../services/pdfService.js"; // ✅ For splitText
import { successResponse, errorResponse } from "../utils/response.js";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME_FOR_KB;

export const handler = async (event) => {
  try {
    const body = event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body, "base64").toString("utf-8"))
      : JSON.parse(event.body);

    const { content } = body;

    if (!content || typeof content !== "string") {
      return errorResponse("Missing or invalid content");
    }

    await PineconeService.ensureIndexExists();

    const docId = `manual-${Date.now()}`;
    const addedAt = new Date().toISOString();
    const s3Key = `shellbot-knowledgebase/${docId}.json`;

    // 🔹 Save original content to S3
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify({ docId, content, addedAt }),
      ContentType: "application/json",
    });
    await s3Client.send(putCommand);

    // ✅ Full URL to the file in S3
    const sourceUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // 🔹 Split content into chunks
    const chunks = PDFService.splitText(content); // ✅ Use same splitter as PDF handler

    //console.log("🔹 CHUNKS COUNT:", chunks.length);

    // 🔹 Create embeddings for each chunk
    const embeddings = await EmbeddingService.createEmbeddings(chunks);

    const vectors = embeddings.map((embedding, i) => ({
      id: `${docId}-chunk-${i}`,
      values: embedding,
      metadata: {
        text: chunks[i],
        docId,
        sourceUrl,
        chunkIndex: i,
        addedAt,
        version: "v1",
      },
    }));

    // 🔹 Upsert all vectors to Pinecone
    await PineconeService.upsertVectors(vectors);

    return successResponse({
      message: "Content saved to S3 and embedded into Pinecone",
      docId,
      chunksAdded: vectors.length,
      s3Key,
      sourceUrl,
      addedAt,
    });
  } catch (error) {
    console.error("addKnowledgebase handler error:", error);
    return errorResponse(error);
  }
};
