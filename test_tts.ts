import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

async function test() {
    try {
        console.log("Calling aleq-audio...");

        let client = (ai as any).clients ? (ai as any).clients : ai;

        // Just try 2.0-flash with no config to see if it works with text
        const textRes = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: "Say this with a Cinematic tone: Hello, adventurer!",
        });
        console.log("Text works:", textRes.text?.substring(0, 10));

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
