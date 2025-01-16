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

  private createChunk(content: string, metadata: Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>, index: number): TextChunk {
    return {
      content: content.trim(),
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: 0 // Placeholder, updated after all chunks created
      }
    };
  }

  private splitLongSentence(sentence: string): string[] {
    const words = sentence.split(' ');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      if (currentChunk.length + word.length + 1 > this.TARGET_CHUNK_SIZE && currentChunk.length >= this.MIN_CHUNK_SIZE) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += (currentChunk ? ' ' : '') + word;
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

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
      
      // If sentence is longer than target size, split it
      if (trimmedSentence.length > this.TARGET_CHUNK_SIZE) {
        // First, add current chunk if not empty
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(currentChunk, metadata, chunks.length));
          currentChunk = '';
        }
        
        // Split and add long sentence chunks
        const sentenceChunks = this.splitLongSentence(trimmedSentence);
        sentenceChunks.forEach(chunk => {
          chunks.push(this.createChunk(chunk, metadata, chunks.length));
        });
        continue;
      }

      // Handle normal-sized sentences
      if (currentChunk.length + trimmedSentence.length > this.TARGET_CHUNK_SIZE && 
          currentChunk.length >= this.MIN_CHUNK_SIZE) {
        chunks.push(this.createChunk(currentChunk, metadata, chunks.length));
        currentChunk = '';
      }
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }

    // Add final chunk if not empty
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, metadata, chunks.length));
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