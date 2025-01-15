import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Utility function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Utility function to print vector stats
function analyzeVector(embedding: number[], label: string) {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
  const variance = embedding.reduce((sum, val) => sum + (val - mean) ** 2, 0) / embedding.length;
  
  console.log(`\n${label} Analysis:`);
  console.log(`Magnitude: ${magnitude.toFixed(6)}`);
  console.log(`Mean: ${mean.toFixed(6)}`);
  console.log(`Variance: ${variance.toFixed(6)}`);
  console.log(`First 5 components: ${embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}`);
}

async function analyzeEmbeddings() {
  dotenv.config();

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test queries with varying semantic relationships
    const queries = [
      "password",                    // Base query
      "reset password",              // Related query
      "login",                       // Semi-related query
      "banana",                      // Unrelated query
      "completely random text",      // Random query
    ];

    console.log('Generating embeddings for analysis...\n');

    // Generate embeddings for all queries
    const embeddings = await Promise.all(
      queries.map(async query => {
        const response = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: query,
        });
        return {
          query,
          embedding: response.data[0].embedding,
        };
      })
    );

    // Analyze each embedding
    embeddings.forEach(({ query, embedding }) => {
      analyzeVector(embedding, `Query: "${query}"`);
    });

    // Calculate and display similarity matrix
    console.log('\nSimilarity Matrix:');
    console.log('Query'.padEnd(25), queries.map(q => q.padEnd(15)).join(''));
    embeddings.forEach((e1, i) => {
      const similarities = embeddings.map(e2 => 
        cosineSimilarity(e1.embedding, e2.embedding).toFixed(6)
      );
      console.log(e1.query.padEnd(25), similarities.map(s => s.padEnd(15)).join(''));
    });

  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

analyzeEmbeddings(); 