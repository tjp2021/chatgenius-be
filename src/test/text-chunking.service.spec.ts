import { Test, TestingModule } from '@nestjs/testing';
import { TextChunkingService } from '../lib/text-chunking.service';

describe('TextChunkingService', () => {
  let service: TextChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextChunkingService],
    }).compile();

    service = module.get(TextChunkingService);
  });

  const testMetadata = {
    messageId: 'test-id',
    timestamp: new Date().toISOString(),
    userId: 'user-1',
    channelId: 'channel-1',
    content: ''
  };

  describe('chunkText', () => {
    it('should return empty array for empty input', () => {
      const result = service.chunkText('', testMetadata);
      expect(result).toEqual([]);
    });

    it('should create single chunk for short text', () => {
      const shortText = 'This is a short message.';
      const result = service.chunkText(shortText, testMetadata);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(shortText);
      expect(result[0].metadata.totalChunks).toBe(1);
      expect(result[0].metadata.chunkIndex).toBe(0);
    });

    it('should split long text into multiple chunks', () => {
      // Create a long text by repeating a sentence
      const sentence = 'This is a test sentence that will be repeated to create a long text. ';
      const longText = sentence.repeat(20);
      
      const result = service.chunkText(longText, testMetadata);
      
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].metadata.totalChunks).toBe(result.length);
      expect(result.every(chunk => chunk.content.length <= 512)).toBe(true);
    });

    it('should maintain overlap between chunks', () => {
      const text = 'First chunk content. Second chunk content. Third chunk content.';
      const overlap = 2; // Small overlap for testing
      const result = service.chunkText(text, testMetadata, overlap);

      // If we have multiple chunks, check for overlap
      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          const prevChunkWords = result[i - 1].content.split(' ');
          const currentChunkWords = result[i].content.split(' ');
          
          // Get the last 'overlap' words from previous chunk
          const overlapFromPrev = prevChunkWords.slice(-overlap).join(' ');
          // Get the first 'overlap' words from current chunk
          const overlapInCurrent = currentChunkWords.slice(0, overlap).join(' ');
          
          expect(overlapInCurrent).toBe(overlapFromPrev);
        }
      }
    });

    it('should respect custom overlap size', () => {
      const sentence = 'Word1 Word2 Word3 Word4 Word5. ';
      const longText = sentence.repeat(20); // Make it long enough to create multiple chunks
      const customOverlap = 3;
      
      const result = service.chunkText(longText, testMetadata, customOverlap);
      
      if (result.length > 1) {
        const firstChunkWords = result[0].content.split(' ');
        const secondChunkWords = result[1].content.split(' ');
        
        const overlapFromFirst = firstChunkWords.slice(-customOverlap).join(' ');
        const overlapInSecond = secondChunkWords.slice(0, customOverlap).join(' ');
        
        expect(overlapInSecond).toBe(overlapFromFirst);
      }
    });

    it('should handle real conversation text with proper chunking and overlap', () => {
      const conversationText = 'User: Hey, I need help with React state management. ' +
        'Assistant: I understand your concern. State management in React can be challenging as applications grow larger. ' +
        'You have several options like Context API, Redux, and MobX. Let me explain each one in detail. ' +
        'The Context API is built into React and is perfect for simple applications. It helps you avoid prop drilling and provides a way to share state between components without passing props manually through every level. ' +
        'Redux is more suitable for complex applications. It provides a robust, predictable state container and is particularly useful when you have lots of application state needed in many places, frequent state updates, or complex state logic. ' +
        'MobX is another popular solution that makes state management simple and scalable by transparently applying functional reactive programming principles. ' +
        'Would you like me to provide some code examples for implementing any of these solutions in your application?';

      const result = service.chunkText(conversationText, testMetadata);

      // Verify chunks are created with appropriate size and metadata
      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk, index) => {
        expect(chunk.content.length).toBeLessThanOrEqual(512);
        expect(chunk.metadata.chunkIndex).toBe(index);
        expect(chunk.metadata.totalChunks).toBe(result.length);
      });
    });
  });
});