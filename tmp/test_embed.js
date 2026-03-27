
const { GoogleGenAI } = require('@google/genai');

async function testEmbedding() {
    const apiKey = 'AIzaSyBktoXwBM4x2PlkVG8bObDwtqXKX6DxH7w'; // From .env.local
    const ai = new GoogleGenAI({ apiKey });
    const text = "Test embedding content";
    const model = 'models/embedding-001';

    try {
        console.log("Attempting embedding with @google/genai...");
        const response = await ai.models.embedContent({
            model: model,
            contents: [{ parts: [{ text: text }] }]
        });
        console.log("Response successful!");
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (error) {
        console.error("Embedding failed:", error);
    }
}

testEmbedding();
