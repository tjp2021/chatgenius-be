import { FileContentService } from './lib/file-content.service';
import { S3Service } from './modules/files/services/s3.service';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

async function testFileExtraction() {
  // Load environment variables
  config();
  
  const configService = new ConfigService();
  const s3Service = new S3Service(configService);
  const fileContentService = new FileContentService(s3Service);

  try {
    // Test with a .txt file
    console.log('Testing .txt file extraction...');
    const textContent = await fileContentService.extractTextContent('test/sample.txt');
    console.log('Text content:', textContent);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFileExtraction(); 