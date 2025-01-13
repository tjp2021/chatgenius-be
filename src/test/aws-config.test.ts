import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from 'dotenv';

// Load environment variables
config();

async function testAwsConfig() {
  console.log('🚀 Starting AWS S3 Configuration Test...\n');

  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY!,
      secretAccessKey: process.env.AWS_SECRET_KEY!,
    },
  });

  try {
    // Test 1: List Buckets (Verify Credentials)
    console.log('📝 Test 1: Verifying AWS Credentials...');
    const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}));
    console.log('✅ Success: AWS credentials are valid');
    console.log('📦 Available buckets:', listBucketsResponse.Buckets?.map(b => b.Name).join(', '), '\n');

    // Test 2: Upload Test File
    console.log('📝 Test 2: Testing File Upload...');
    const testKey = 'test/config-test.txt';
    const testContent = 'This is a test file for AWS S3 configuration verification.';
    
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    }));
    console.log('✅ Success: Test file uploaded successfully\n');

    // Test 3: Generate Pre-signed URL
    console.log('📝 Test 3: Testing Pre-signed URL Generation...');
    const getCommand = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: testKey,
    });
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    console.log('✅ Success: Pre-signed URL generated');
    console.log('🔗 URL:', presignedUrl, '\n');

    // Test 4: Clean Up
    console.log('📝 Test 4: Cleaning Up Test File...');
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: testKey,
    }));
    console.log('✅ Success: Test file cleaned up\n');

    console.log('🎉 All tests passed! AWS S3 configuration is working correctly.');

  } catch (error) {
    console.error('❌ Error during AWS S3 configuration test:', error);
    throw error;
  }
}

// Run the test
testAwsConfig()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 