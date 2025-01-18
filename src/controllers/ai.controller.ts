import { Controller, Post, Body, UseGuards, HttpCode, Req } from '@nestjs/common';
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
} from './dto/ai.dto';
import { AvatarAnalysis } from '../interfaces/avatar.interface';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';

@Controller('ai')
@UseGuards(ClerkAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('test')
  async testAiEndpoint(
    @Body() body: AiTestRequestDto,
    @Req() req: any
  ): Promise<AiTestResponseDto> {
    // Test the message gathering functionality
    const messages = await this.aiService.gatherChannelContext(body.channelId);
    
    return {
      status: 'success',
      message: `Found ${messages.length} messages in channel`,
      channelId: body.channelId
    };
  }

  @Post('synthesize')
  async synthesizeResponse(
    @Body() body: AiSynthesisRequestDto,
    @Req() req: any
  ) {
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
  async analyzeChannel(
    @Body() body: { channelId: string },
    @Req() req: any
  ) {
    return await this.aiService.analyzeChannelConversations(body.channelId);
  }

  @Post('analyze-style')
  async analyzeUserStyle(
    @Body() body: UserStyleAnalysisRequestDto,
    @Req() req: any
  ): Promise<UserStyleAnalysisResponseDto> {
    const result = await this.aiService.analyzeUserStyle(req.auth.userId);
    return {
      ...result,
      analyzedAt: new Date()
    };
  }

  @Post('generate-styled')
  async generateStyledResponse(
    @Body() body: { prompt: string },
    @Req() req: any
  ) {
    return await this.aiService.generateStyledResponse(
      req.auth.userId,
      body.prompt
    );
  }

  @Post('extract-document')
  async extractDocumentContent(
    @Body() body: { fileId: string },
    @Req() req: any
  ) {
    return await this.aiService.extractDocumentContent(body.fileId);
  }

  @Post('avatar')
  async createAvatar(
    @Body() body: CreateAvatarRequestDto,
    @Req() req: any
  ) {
    return this.aiService.createUserAvatar(req.auth.userId);
  }

  @Post('avatar/response')
  async generateAvatarResponse(
    @Body() body: { prompt: string },
    @Req() req: any
  ): Promise<{ response: string }> {
    const response = await this.aiService.generateAvatarResponse(
      req.auth.userId,
      body.prompt
    );
    return { response };
  }

  @Post('avatar/update')
  @HttpCode(200)
  async updateAvatar(
    @Body() body: { userId: string },
    @Req() req: any
  ): Promise<AvatarAnalysisDto> {
    return this.aiService.updateUserAvatar(req.auth.userId);
  }
} 