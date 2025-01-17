import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

async function testOpenAI() {
  dotenv.config();
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    console.log('Testing OpenAI connection...');
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: 'Test message'
    });
    
    console.log('✅ Successfully connected to OpenAI!');
    console.log('Embedding dimensions:', response.data[0].embedding.length);
    console.log('First few values:', response.data[0].embedding.slice(0, 3));
  } catch (error) {
    console.error('❌ Error connecting to OpenAI:', error.message);
    console.error('Error details:', error);
  }
}

testOpenAI(); 