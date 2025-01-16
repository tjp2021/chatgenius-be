import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { AiService } from '../lib/ai.service';
import { 
  AiTestRequestDto, 
  AiTestResponseDto, 
  AiSynthesisRequestDto, 
  UserStyleAnalysisRequestDto, 
  UserStyleAnalysisResponseDto,
  CreateAvatarRequestDto,
  AvatarAnalysisDto,
  GenerateAvatarResponseDto,
  SearchMessagesRequestDto,
  SearchMessagesResponseDto
} from './dto/ai.dto';
import { AvatarAnalysis } from '../interfaces/avatar.interface';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';

@Controller('ai')
@UseGuards(ClerkAuthGuard)
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

  @Post('analyze-channel')
  async analyzeChannel(@Body() body: { channelId: string }) {
    return await this.aiService.analyzeChannelConversations(body.channelId);
  }

  @Post('analyze-style')
  async analyzeUserStyle(
    @Body() body: UserStyleAnalysisRequestDto
  ): Promise<UserStyleAnalysisResponseDto> {
    const result = await this.aiService.analyzeUserStyle(body.userId);
    return {
      ...result,
      analyzedAt: new Date()
    };
  }

  @Post('generate-styled')
  async generateStyledResponse(
    @Body() body: { userId: string; prompt: string }
  ) {
    return await this.aiService.generateStyledResponse(
      body.userId,
      body.prompt
    );
  }

  @Post('extract-document')
  async extractDocumentContent(@Body() body: { fileId: string }) {
    return await this.aiService.extractDocumentContent(body.fileId);
  }

  @Post('avatar')
  async createAvatar(@Body() body: CreateAvatarRequestDto) {
    return this.aiService.createUserAvatar(body.userId);
  }

  @Post('avatar/response')
  async generateAvatarResponse(
    @Body() body: { userId: string; prompt: string }
  ): Promise<{ response: string }> {
    const response = await this.aiService.generateAvatarResponse(
      body.userId,
      body.prompt
    );
    return { response };
  }

  @Post('avatar/update')
  @HttpCode(200)
  async updateAvatar(@Body() body: { userId: string }): Promise<AvatarAnalysisDto> {
    return this.aiService.updateUserAvatar(body.userId);
  }

  @Post('messages/search')
  @HttpCode(200)
  async searchMessages(
    @Body() body: SearchMessagesRequestDto
  ): Promise<SearchMessagesResponseDto[]> {
    return this.aiService.searchMessages(body.query, {
      userId: body.userId,
      channelId: body.channelId,
      limit: body.limit
    });
  }
} 