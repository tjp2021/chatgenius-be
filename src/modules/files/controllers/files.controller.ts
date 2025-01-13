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
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import {
  ApiTags,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesService } from '../services/files.service';
import { FileUploadDto, FileSearchDto } from '../dto/file.dto';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { User } from '../../../auth/decorators/user.decorator';
import { memoryStorage } from 'multer';

@ApiTags('File Management')
@Controller('files')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload a new file',
    description: `
      Uploads a file to the system with the following constraints:
      - Maximum file size: 5MB
      - Allowed file types: JPEG, PNG, PDF
      - Files are stored in AWS S3 with user-specific paths
      - Returns a pre-signed URL valid for 1 hour
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File to upload',
    type: FileUploadDto,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        name: { type: 'string', example: 'document.pdf' },
        url: { type: 'string', example: 'https://s3.amazonaws.com/bucket/user-id/uuid-document.pdf' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file upload request',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { 
          type: 'string',
          example: 'Invalid file type. Allowed types: image/jpeg, image/png, application/pdf',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, callback) => {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        callback(new BadRequestException(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
      }
      callback(null, true);
    },
  }))
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
  @ApiOperation({
    summary: 'Get file details by ID',
    description: `
      Retrieves file metadata and generates a pre-signed URL for download.
      The URL is valid for 1 hour from the time of request.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the file',
    type: 'string',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        name: { type: 'string', example: 'document.pdf' },
        type: { type: 'string', example: 'application/pdf' },
        size: { type: 'number', example: 1048576 },
        url: { type: 'string', example: 'https://s3.amazonaws.com/bucket/user-id/uuid-document.pdf' },
        userId: { type: 'string', example: 'user-123' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'File not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async getFile(@Param('id') id: string) {
    return this.filesService.findById(id);
  }

  @Get()
  @ApiOperation({
    summary: 'Search files',
    description: `
      Search and filter files with pagination support.
      Results are ordered by creation date (newest first).
      Pre-signed URLs are generated for each file in the results.
    `,
  })
  @ApiQuery({
    name: 'filename',
    required: false,
    description: 'Filter by filename (partial match)',
    type: 'string',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by file type (exact match)',
    type: 'string',
    example: 'image/jpeg',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Number of records to skip (pagination)',
    type: 'number',
    minimum: 0,
  })
  @ApiQuery({
    name: 'take',
    required: false,
    description: 'Number of records to return (pagination)',
    type: 'number',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Files retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              size: { type: 'number' },
              url: { type: 'string' },
              userId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { 
          type: 'number',
          description: 'Total number of files matching the search criteria',
        },
      },
    },
  })
  async searchFiles(@Query() query: FileSearchDto, @User('id') userId: string) {
    return this.filesService.search({ ...query, userId });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a file',
    description: `
      Permanently deletes a file from both S3 storage and database.
      This operation cannot be undone.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the file to delete',
    type: 'string',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'File deleted successfully' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'File not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async deleteFile(@Param('id') id: string) {
    await this.filesService.delete(id);
    return { message: 'File deleted successfully' };
  }
} 