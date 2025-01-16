import { FilesService } from './modules/files/services/files.service';
import { S3Service } from './modules/files/services/s3.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './lib/prisma.service';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { TextChunkingService } from './lib/text-chunking.service';
import { VectorStoreService } from './lib/vector-store.service';
import { OpenAIService } from './lib/openai.service';
import { PineconeService } from './lib/pinecone.service';
import { EmbeddingService } from './lib/embedding.service';

async function testFileUpload() {
  // Load environment variables from existing .env
  config();
  
  // Initialize services
  const configService = new ConfigService();
  const prismaService = new PrismaService();
  const s3Service = new S3Service(configService);
  const openAIService = new OpenAIService(configService);
  const pineconeService = new PineconeService(configService);
  const embeddingService = new EmbeddingService(configService);
  const textChunkingService = new TextChunkingService();
  const vectorStoreService = new VectorStoreService(pineconeService, embeddingService, textChunkingService);
  const filesService = new FilesService(prismaService, s3Service, textChunkingService, vectorStoreService);

  try {
    // First, get a valid user ID from the database
    const user = await prismaService.user.findFirst();
    if (!user) {
      throw new Error('No user found in database');
    }

    // Read the PDF file
    const filePath = path.join(__dirname, 'test/fixtures/canelo-analysis.pdf');
    const fileBuffer = fs.readFileSync(filePath);
    const fileStats = fs.statSync(filePath);

    // Create a mock Multer file object
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'canelo-analysis.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: fileStats.size,
      destination: '',
      filename: '',
      path: '',
      buffer: fileBuffer,
      stream: null as any,
    };

    console.log('Using user ID:', user.id);
    console.log('Uploading file...');
    const result = await filesService.create(mockFile, user.id);
    console.log('Upload successful!');
    console.log('File ID:', result.id);
    console.log('File URL:', result.url);
    console.log('Extracted text length:', result.textContent?.length);
    console.log('First 500 characters of extracted text:');
    console.log(result.textContent?.substring(0, 500));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Clean up
    await prismaService.$disconnect();
  }
}

testFileUpload(); 