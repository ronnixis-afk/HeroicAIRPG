import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response: any = await ai.models.list();
        const models = response.models || response.pageInternal || response;
        if (Array.isArray(models)) {
            const names = models.map((m: any) => m.name || m.id);
            console.log('--- MODELS STARTING WITH GEMINI-3 ---');
            names.filter(n => n.includes('gemini-3')).forEach(n => console.log(n));
            console.log('--- MODELS WITH FLASH-LITE ---');
            names.filter(n => n.includes('flash-lite')).forEach(n => console.log(n));
        } else {
            console.log('Unexpected response structure');
        }
    } catch (error) {
        console.error('Failed to list models:', error);
    }
}

listModels();
