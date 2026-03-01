// utils/mathUtils.ts

/**
 * Calculates the cosine similarity between two numerical vectors.
 * Returns a value between -1 and 1, where 1 means identical direction (perfect semantic match).
 *
 * @param vecA The first vector (e.g., query embedding)
 * @param vecB The second vector (e.g., target lore/memory embedding)
 * @returns The cosine similarity score
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
        return -1; // Invalid or mismatched vectors
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return -1; // Prevent division by zero
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Searches an array of data objects, scoring them by their vector similarity to a query vector.
 * 
 * @param queryVector The embedding vector of the user's search query.
 * @param items The array of objects to search through.
 * @param getEmbedding A function that extracts the embedding array from an item.
 * @param topK The maximum number of results to return.
 * @param threshold The minimum cosine similarity score to be considered a match (0-1).
 * @returns The top matching items sorted by relevance.
 */
export const searchEmbeddings = <T>(
    queryVector: number[],
    items: T[],
    getEmbedding: (item: T) => number[] | undefined,
    topK: number = 5,
    threshold: number = 0.5
): Array<{ item: T, score: number }> => {

    if (!queryVector || queryVector.length === 0 || !items || items.length === 0) {
        return [];
    }

    const scoredItems = items.map(item => {
        const itemVector = getEmbedding(item);
        if (!itemVector || itemVector.length === 0) {
            return { item, score: -1 };
        }

        const score = cosineSimilarity(queryVector, itemVector);
        return { item, score };
    });

    return scoredItems
        .filter(result => result.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};
