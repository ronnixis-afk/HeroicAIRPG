// src/config/aiConfig.ts

/**
 * Centralized AI Model Configuration
 * Update these constants to change the models used across all services.
 */
export const AI_MODELS = {
    /**
     * Primary reasoning and narrative model.
     * Used for most game logic, narration, and NPC interactions.
     */
    DEFAULT: 'gemini-3.1-flash-lite-preview',

    /**
     * Text-to-Speech model.
     * Used for high-fidelity neural speech generation.
     */
    TTS: 'gemini-2.5-flash-preview-tts',

    /**
     * Image Generation model.
     * Used for character portraits and scene visualizations.
     */
    IMAGE_GEN: 'gemini-3-pro-image-preview',

    /**
     * Real-time Voice interaction model.
     * Used in the LiveVoiceService for low-latency dialogue.
     */
    LIVE_VOICE: 'models/gemini-2.0-flash-exp',

    /**
     * Semantic Embedding model.
     * Used for RAG, lore retrieval, and vector search.
     */
    EMBEDDING: 'text-embedding-004',
};

/**
 * Default thinking budgets for different types of AI operations.
 */
export const THINKING_BUDGETS = {
    /** High budget for complex narrative generation and GM responses */
    NARRATIVE: 5120,
    /** Standard budget for logical tasks and state updates */
    LOGIC: 512,
    /** Medium budget for specific analytical tasks */
    TASK: 1536,
    /** Ultra high budget for complex scenario and character initialization */
    SCENARIO: 10240,
};
