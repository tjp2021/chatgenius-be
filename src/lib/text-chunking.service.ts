import { Injectable } from '@nestjs/common';

interface ChunkMetadata {
  messageId: string;
  chunkIndex: number;
  totalChunks: number;
  timestamp: string;
  userId: string;
  channelId: string;
  content?: string;
}

export interface TextChunk {
  content: string;
  metadata: ChunkMetadata & { content: string };
}

@Injectable()
export class TextChunkingService {
  private readonly TARGET_CHUNK_SIZE = 512;
  private readonly MIN_CHUNK_SIZE = 100;
  private readonly DEFAULT_OVERLAP = 50;

  private createChunk(content: string, metadata: Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks' | 'content'>, index: number): TextChunk {
    const trimmedContent = content.trim();
    return {
      content: trimmedContent,
      metadata: {
        ...metadata,
        content: trimmedContent,
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
    metadata: Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>,
    overlap: number = this.DEFAULT_OVERLAP
  ): TextChunk[] {
    if (!text?.trim()) {
      return [];
    }

    // Normalize text: replace multiple newlines with single newline and remove excessive whitespace
    const normalizedText = text
      .replace(/\n\s+/g, '\n')  // Replace newline + whitespace with just newline
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();

    const sentences = normalizedText.match(/[^.!?]+[.!?]+/g) || [normalizedText];
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let overlapText = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (trimmedSentence.length > this.TARGET_CHUNK_SIZE) {
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(currentChunk, metadata, chunks.length));
          overlapText = currentChunk.split(' ').slice(-overlap).join(' ');
          currentChunk = overlapText;
        }
        
        const sentenceChunks = this.splitLongSentence(trimmedSentence);
        sentenceChunks.forEach((chunk, idx) => {
          const chunkWithOverlap = (idx > 0 ? overlapText + ' ' : '') + chunk;
          chunks.push(this.createChunk(chunkWithOverlap, metadata, chunks.length));
          overlapText = chunk.split(' ').slice(-overlap).join(' ');
        });
        currentChunk = overlapText;
        continue;
      }

      if (currentChunk.length + trimmedSentence.length > this.TARGET_CHUNK_SIZE && 
          currentChunk.length >= this.MIN_CHUNK_SIZE) {
        chunks.push(this.createChunk(currentChunk, metadata, chunks.length));
        overlapText = currentChunk.split(' ').slice(-overlap).join(' ');
        currentChunk = overlapText;
      }
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }

    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, metadata, chunks.length));
    }

    return chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        totalChunks: chunks.length
      }
    }));
  }

  reconstructText(chunks: TextChunk[]): string {
    if (chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0].content;

    // Sort chunks by index
    const sortedChunks = chunks.sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);
    
    // Start with the first chunk
    let result = sortedChunks[0].content;

    // For each subsequent chunk, find where the overlap begins and append the rest
    for (let i = 1; i < sortedChunks.length; i++) {
      const currentChunk = sortedChunks[i].content.trim();
      const prevChunk = sortedChunks[i - 1].content.trim();
      
      // Get the last N words of the previous chunk to find the overlap
      const lastWords = prevChunk.split(' ').slice(-this.DEFAULT_OVERLAP).join(' ');
      
      // Find where these words appear in the current chunk
      const overlapIndex = currentChunk.indexOf(lastWords);
      
      if (overlapIndex >= 0) {
        // Append only the content after the overlap, ensuring single space
        const newContent = currentChunk.slice(overlapIndex + lastWords.length).trim();
        if (newContent) {
          result += ' ' + newContent;
        }
      } else {
        // If no overlap found, just append with a space
        result += ' ' + currentChunk;
      }
    }

    // Normalize spaces
    return result.replace(/\s+/g, ' ').trim();
  }
} 