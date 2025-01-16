import { Injectable } from '@nestjs/common';

interface ChunkMetadata {
  messageId: string;
  chunkIndex: number;
  totalChunks: number;
  timestamp: string;
  userId: string;
  channelId: string;
}

interface TextChunk {
  content: string;
  metadata: ChunkMetadata;
}

@Injectable()
export class TextChunkingService {
  // Optimal chunk size based on OpenAI's embedding model
  private readonly TARGET_CHUNK_SIZE = 512;
  private readonly MIN_CHUNK_SIZE = 100;

  chunkText(
    text: string,
    metadata: Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>
  ): TextChunk[] {
    if (!text?.trim()) {
      return [];
    }

    // Split into sentences first for semantic coherence
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: TextChunk[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      // If adding this sentence exceeds target size, start new chunk
      if (currentChunk.length + trimmedSentence.length > this.TARGET_CHUNK_SIZE && 
          currentChunk.length >= this.MIN_CHUNK_SIZE) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            ...metadata,
            chunkIndex: chunks.length,
            totalChunks: 0 // Placeholder, updated after all chunks created
          }
        });
        currentChunk = '';
      }
      currentChunk += trimmedSentence + ' ';
    }

    // Add final chunk if not empty
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          ...metadata,
          chunkIndex: chunks.length,
          totalChunks: 0
        }
      });
    }

    // Update total chunks count
    return chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        totalChunks: chunks.length
      }
    }));
  }

  reconstructText(chunks: TextChunk[]): string {
    return chunks
      .sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex)
      .map(chunk => chunk.content)
      .join(' ');
  }
} 