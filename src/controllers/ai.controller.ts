import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from '../lib/ai.service';
import { AiTestRequestDto, AiTestResponseDto, AiSynthesisRequestDto } from './dto/ai.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('test')
  async testAiEndpoint(@Body() body: AiTestRequestDto): Promise<AiTestResponseDto> {
    // Test the message gathering functionality
    const messages = await this.aiService.gatherChannelContext(body.channelId);
    
    return {
      status: 'success',
      message: `Found ${messages.length} messages in channel`,
      channelId: body.channelId
    };
  }

  @Post('synthesize')
  async synthesizeResponse(@Body() body: AiSynthesisRequestDto) {
    const result = await this.aiService.synthesizeResponse(body.channelId, body.prompt);
    return {
      status: 'success',
      channelId: body.channelId,
      prompt: body.prompt,
      response: result.response,
      contextMessageCount: result.contextMessageCount
    };
  }
} 