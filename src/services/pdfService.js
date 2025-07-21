import crypto from "crypto";
import { promises as fs } from "fs";

import os from "os";

import { CONSTANTS } from "../utils/constants.js";

class PDFServiceClass {
  constructor(
    tempDir = os.tmpdir(),
    chunkSize = CONSTANTS.CHUNK_SIZE,
    overlap = CONSTANTS.CHUNK_OVERLAP
  ) {
    this.tempDir = tempDir;
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  generateDocumentId(source) {
    return crypto.createHash("md5").update(source).digest("hex");
  }

  splitText(text) {
    const isNonSpaceSeparated =
      /[\u3040-\u30FF\u4E00-\u9FAF\u0600-\u06FF\u0980-\u09FF]/.test(text); // Japanese, Chinese, Arabic, Bengali

    const chunks = [];

    if (isNonSpaceSeparated) {
      // Character-based chunking
      for (let i = 0; i < text.length; i += this.chunkSize - this.overlap) {
        const chunk = text.slice(i, i + this.chunkSize);
        if (chunk.trim()) {
          chunks.push(chunk);
        }
      }
    } else {
      // Word-based chunking (for English)
      const words = text.split(" ");
      for (let i = 0; i < words.length; i += this.chunkSize - this.overlap) {
        const chunk = words.slice(i, i + this.chunkSize).join(" ");
        if (chunk.trim()) {
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Could not delete file ${filePath}:`, error.message);
    }
  }
}

const PDFService = new PDFServiceClass();
export default PDFService;
