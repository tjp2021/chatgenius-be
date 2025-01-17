import { Injectable } from '@nestjs/common';
import { MessagesService } from '../../messages/services/messages.service';
import { ResponseSynthesisService } from '../../../lib/response-synthesis.service';
import { SearchOptions } from '../../messages/interfaces/search.interface';

@Injectable()
export class SearchService {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly responseSynthesisService: ResponseSynthesisService,
  ) {}

  async search(query: string, options: SearchOptions) {
    console.log('🔍 [SearchService] Starting search with options:', {
      query,
      options,
      searchType: options.searchType || 'semantic'
    });

    const messages = await this.messagesService.searchMessages(
      options.userId,
      query,
      {
        userId: options.userId,
        limit: options.limit,
        cursor: options.cursor,
        minScore: options.minScore,
        fromUserId: options.fromUserId,
        channelId: options.channelId,
        searchType: options.searchType || 'semantic'
      }
    );

    console.log('🔍 [SearchService] Search results:', {
      total: messages.total,
      hasItems: messages.items?.length > 0,
      firstItemScore: messages.items?.[0]?.score,
      firstItemContent: messages.items?.[0]?.content?.substring(0, 100)
    });

    return messages;
  }

  async generateRagResponse(userId: string, query: string): Promise<string> {
    console.log('🔍 [SearchService] Generating RAG response:', {
      userId,
      query
    });

    // Get relevant messages
    const messages = await this.messagesService.searchMessages(userId, query, {
      userId,
      limit: 5,
      minScore: 0.5,
      searchType: 'semantic'
    });

    console.log('🔍 [SearchService] RAG search results:', {
      total: messages.total,
      hasItems: messages.items?.length > 0,
      scores: messages.items?.map(m => m.score)
    });

    if (!messages.items?.length) {
      console.log('⚠️ [SearchService] No relevant messages found for RAG');
      return 'I could not find any relevant context to answer your question.';
    }

    console.log('🔍 [SearchService] Found relevant messages:', {
      count: messages.items.length
    });

    // Format context messages
    const context = messages.items.map(msg => {
      return `${msg.user.name}: ${msg.content}`;
    }).join('\n\n');

    // Synthesize response
    const response = await this.responseSynthesisService.synthesizeResponse({
      channelId: 'rag-response',
      prompt: `Based on the following context, answer this question:\n\nContext:\n${context}\n\nQuestion: ${query}`
    });
    
    console.log('🔍 [SearchService] Generated RAG response');
    return response.response;
  }
} 