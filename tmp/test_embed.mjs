import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

async function test() {
    if (!apiKey) {
        console.error("No API key found in .env.local");
        return;
    }
    const ai = new GoogleGenAI({ apiKey });
    console.log("AI initialized. Models property exists:", !!ai.models);
    
    try {
        console.log("Testing ai.models.embedContent with string...");
        const res1 = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: "Hello world"
        });
        console.log("Res1 success:", !!res1);
    } catch (e) {
        console.error("Res1 failed:", e.message);
        if (e.response) {
            console.error("Response data:", await e.response.json());
        }
    }

    try {
        console.log("Testing ai.models.embedContent with Content object...");
        const res2 = await ai.models.embedContent({
            model: "text-embedding-004",
            content: { parts: [{ text: "Hello world" }] }
        });
        console.log("Res2 success:", !!res2);
    } catch (e) {
        console.error("Res2 failed:", e.message);
    }
}

test();
