// Mocking the GoogleGenAI interface to proxy requests to our secure Next.js backend.
export const getAi = (): any => {
    return {
        models: {
            generateContent: async (requestOptions: any) => {
                const MAX_RETRIES = 3;
                let attempt = 0;

                while (attempt < MAX_RETRIES) {
                    try {
                        const response = await fetch('/api/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestOptions)
                        });

                        if (!response.ok) {
                            const errStr = await response.text();

                            // Check if this is a 503 High Demand Error from Gemini
                            if (response.status === 503 || errStr.includes('503') || errStr.includes('UNAVAILABLE')) {
                                attempt++;
                                if (attempt >= MAX_RETRIES) {
                                    throw new Error(`Gemini API is overloaded. Please try again later. (${errStr})`);
                                }
                                // Exponential backoff: 1s, 2s, 4s...
                                const delayMs = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500;
                                console.warn(`Gemini 503 overloaded. Retrying... (Attempt ${attempt}/${MAX_RETRIES} in ${Math.round(delayMs)}ms)`);
                                await new Promise(resolve => setTimeout(resolve, delayMs));
                                continue;
                            }

                            // For other errors (like 401 Unauthorized), throw immediately
                            throw new Error(errStr);
                        }

                        const data = await response.json();
                        return { text: data.text, usageMetadata: data.usageMetadata, candidates: data.candidates };
                    } catch (error: any) {
                        // If it's the last attempt or NOT a 503 error, propogate it outwards
                        if (attempt >= MAX_RETRIES || (!error.message?.includes('503') && !error.message?.includes('UNAVAILABLE'))) {
                            throw error;
                        }
                    }
                }
            }
        }
    };
};

export const getEmbeddingAi = (): any => {
    return {
        models: {
            embedContent: async (requestOptions: { model?: string, contents: string }) => {
                const response = await fetch('/api/embed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: requestOptions.contents,
                        model: requestOptions.model || 'text-embedding-004'
                    })
                });

                if (!response.ok) {
                    const errStr = await response.text();
                    throw new Error(errStr);
                }

                const data = await response.json();
                return { embeddings: [{ values: data.embedding }] };
            }
        }
    };
};

/**
 * Strips markdown code blocks and extracts the primary JSON structure (object or array).
 */
export const cleanJson = (text: string): string => {
    if (!text) return '{}';

    // 1. Remove Markdown syntax (```json, ```)
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. Scan for JSON object pattern {} or array pattern []
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    const lastBrace = clean.lastIndexOf('}');
    const lastBracket = clean.lastIndexOf(']');

    let start = -1;
    let end = -1;

    // Determine start based on what appears first
    if (firstBrace !== -1 && (firstBracket === -1 || (firstBrace < firstBracket && firstBrace !== -1))) {
        start = firstBrace;
        end = lastBrace;
    } else if (firstBracket !== -1) {
        start = firstBracket;
        end = lastBracket;
    }

    if (start !== -1 && end !== -1 && end > start) {
        clean = clean.substring(start, end + 1);
    }

    return clean;
};
