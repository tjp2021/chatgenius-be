import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FilesService } from '../services/files.service';
import { FileUploadDto, FileSearchDto } from '../dto/file.dto';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { User } from '../../../auth/decorators/user.decorator';

@ApiTags('files')
@Controller('files')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @User('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.filesService.create(file, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiResponse({ status: 200, description: 'File details retrieved' })
  async getFile(@Param('id') id: string) {
    return this.filesService.findById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Search files' })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully' })
  async searchFiles(@Query() query: FileSearchDto, @User('id') userId: string) {
    return this.filesService.search({ ...query, userId });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete file' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(@Param('id') id: string) {
    await this.filesService.delete(id);
    return { message: 'File deleted successfully' };
  }
} 