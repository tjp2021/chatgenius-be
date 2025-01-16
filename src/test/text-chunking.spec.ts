import { Test, TestingModule } from '@nestjs/testing';
import { TextChunkingService } from '../lib/text-chunking.service';

describe('TextChunkingService', () => {
  let service: TextChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextChunkingService],
    }).compile();

    service = module.get<TextChunkingService>(TextChunkingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty array for empty text', () => {
    const result = service.chunkText('', {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1'
    });
    expect(result).toEqual([]);
  });

  it('should chunk text into appropriate sizes', () => {
    const longText = 'This is a very long sentence that should be split. '.repeat(20);
    const result = service.chunkText(longText, {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1'
    });

    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk, index) => {
      expect(chunk.content.length).toBeLessThanOrEqual(512);
      expect(chunk.metadata.chunkIndex).toBe(index);
      expect(chunk.metadata.totalChunks).toBe(result.length);
    });
  });

  it('should preserve sentence boundaries when possible', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const result = service.chunkText(text, {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1'
    });

    expect(result.length).toBe(1);
    expect(result[0].content).toBe(text);
  });

  it('should reconstruct original text', () => {
    const originalText = 'First sentence. Second sentence. Third sentence.';
    const chunks = service.chunkText(originalText, {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1'
    });

    const reconstructed = service.reconstructText(chunks);
    expect(reconstructed.trim()).toBe(originalText);
  });

  it('should handle very long sentences', () => {
    // Create a sentence longer than TARGET_CHUNK_SIZE (512)
    const longSentence = 'word'.repeat(200); // 800 characters
    const result = service.chunkText(longSentence, {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1'
    });

    expect(result.length).toBeGreaterThan(1);
    result.forEach(chunk => {
      expect(chunk.content.length).toBeLessThanOrEqual(512);
    });

    const reconstructed = service.reconstructText(result);
    expect(reconstructed.trim()).toBe(longSentence);
  });
}); 