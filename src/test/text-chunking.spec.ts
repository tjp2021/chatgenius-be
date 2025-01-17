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
    const testMetadata = {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1',
      content: ''
    };
    const result = service.chunkText('', testMetadata);
    expect(result).toEqual([]);
  });

  it('should chunk text into appropriate sizes', () => {
    const longText = 'This is a very long sentence that should be split. '.repeat(20);
    const testMetadata = {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1',
      content: ''
    };
    const result = service.chunkText(longText, testMetadata);

    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk, index) => {
      expect(chunk.content.length).toBeLessThanOrEqual(512);
      expect(chunk.metadata.chunkIndex).toBe(index);
      expect(chunk.metadata.totalChunks).toBe(result.length);
    });
  });

  it('should preserve sentence boundaries when possible', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const testMetadata = {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1',
      content: ''
    };
    const result = service.chunkText(text, testMetadata);

    expect(result.length).toBe(1);
    expect(result[0].content).toBe(text);
  });

  it('should reconstruct original text', () => {
    const originalText = 'First sentence. Second sentence. Third sentence.';
    const testMetadata = {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1',
      content: ''
    };
    const chunks = service.chunkText(originalText, testMetadata);

    const reconstructed = service.reconstructText(chunks);
    expect(reconstructed.trim()).toBe(originalText);
  });

  it('should handle very long sentences', () => {
    // Create a sentence longer than TARGET_CHUNK_SIZE (512)
    const longWord = 'supercalifragilisticexpialidocious'; // 34 chars
    const longSentence = (longWord + ' ').repeat(20); // ~700 chars
    const testMetadata = {
      messageId: 'test-id',
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      channelId: 'channel-1',
      content: ''
    };
    const result = service.chunkText(longSentence, testMetadata);

    expect(result.length).toBeGreaterThan(1);
    result.forEach(chunk => {
      expect(chunk.content.length).toBeLessThanOrEqual(512);
    });

    const reconstructed = service.reconstructText(result);
    expect(reconstructed.trim()).toBe(longSentence.trim());
  });
}); 