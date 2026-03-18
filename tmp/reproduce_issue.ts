import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY not found in .env.local');
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = 'gemini-3.1-flash-lite-preview';
    
    console.log(`Testing model: ${modelName}`);

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: 'Hello, are you working?' }] }],
            config: {
                // Testing with a numeric budget
                thinkingConfig: { thinkingBudget: 1536 }
            }
        });

        console.log('Response:', response.text);
    } catch (error: any) {
        console.error('Error Details:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

testGemini();
