// services/liveVoiceService.ts

/**
 * GEMINI LIVE API VOICE SERVICE
 * 
 * Manages a real-time bidirectional WebSocket connection to the Gemini Live API
 * for advanced voice interaction. Handles:
 * - Audio capture (mic → PCM16 @ 16kHz → base64 → WebSocket)
 * - Audio playback (base64 chunks → PCM → AudioContext)
 * - Function calling bridge to game pipeline
 * - Barge-in / interruption detection
 * - Transcription capture
 * - Idle timeout
 */
import { AI_MODELS } from '../config/aiConfig';

// Mapping UI voice names to Gemini Live API voice names
const LIVE_VOICE_MAP: Record<string, string> = {
    "Classic Narrator (Male)": "Puck",
    "Mysterious Storyteller (Female)": "Kore",
    "Grizzled Veteran (Male)": "Fenrir",
    "Ethereal Oracle (Female)": "Zephyr",
};

export type LiveVoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface LiveVoiceCallbacks {
    onStatusChange: (status: LiveVoiceStatus) => void;
    onInputTranscription: (text: string) => void;
    onOutputTranscription: (text: string) => void;
    onToolCall: (functionName: string, args: any) => Promise<any>;
    onError: (error: string) => void;
    onDisconnect: () => void;
}

// Function declaration for the game pipeline tool
const PIPELINE_TOOL_DECLARATION = {
    name: "process_player_action",
    description: "Processes the player's spoken action through the RPG game engine's mechanical pipeline. This runs skill assessment, dice rolls, context retrieval, narrative generation, and state auditing. You MUST call this for every player action that progresses the story. Returns the narrative response text that you should then speak aloud naturally.",
    parameters: {
        type: "OBJECT" as const,
        properties: {
            player_action: {
                type: "STRING" as const,
                description: "The player's action or dialogue to process through the game engine"
            }
        },
        required: ["player_action"]
    }
};

export class LiveVoiceService {
    private ws: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private callbacks: LiveVoiceCallbacks | null = null;
    private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private idleTimeoutMs: number = 15000;

    // Audio playback queue
    private playbackQueue: Float32Array[] = [];
    private isPlaying = false;
    private currentSource: AudioBufferSourceNode | null = null;
    private nextPlayTime = 0;
    private activeSources = new Set<AudioBufferSourceNode>();

    // Thinking sound
    private thinkingOscillator: OscillatorNode | null = null;
    private thinkingGain: GainNode | null = null;

    // State
    private _status: LiveVoiceStatus = 'idle';
    private accumulatedInputTranscript = '';
    private accumulatedOutputTranscript = '';

    get status(): LiveVoiceStatus {
        return this._status;
    }

    private setStatus(status: LiveVoiceStatus) {
        this._status = status;
        this.callbacks?.onStatusChange(status);
    }

    /**
     * Connect to the Gemini Live API using an ephemeral token.
     */
    async connect(
        systemInstruction: string,
        voiceName: string,
        callbacks: LiveVoiceCallbacks
    ): Promise<void> {
        this.callbacks = callbacks;
        this.setStatus('connecting');

        try {
            // 1. Fetch ephemeral token from our backend
            const tokenResponse = await fetch('/api/live-token', { method: 'POST' });
            if (!tokenResponse.ok) {
                const err = await tokenResponse.text();
                throw new Error(`Failed to get Live API token: ${err}`);
            }
            const { token } = await tokenResponse.json();

            // 2. Connect WebSocket to Gemini Live API
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?access_token=${token}`;
            
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('[LiveVoice] WebSocket connected');
                
                // 3. Send session configuration
                const targetVoice = LIVE_VOICE_MAP[voiceName] || "Puck";
                
                const configMessage = {
                    setup: {
                        model: AI_MODELS.LIVE_VOICE,
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: targetVoice }
                                }
                            }
                        },
                        systemInstruction: {
                            parts: [{ text: systemInstruction }]
                        },
                        tools: [{ functionDeclarations: [PIPELINE_TOOL_DECLARATION] }],
                        realtimeInputConfig: {
                            automaticActivityDetection: {
                                disabled: false
                            }
                        },
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                    }
                };

                this.ws!.send(JSON.stringify(configMessage));
                console.log('[LiveVoice] Configuration sent');
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event);
            };

            this.ws.onerror = (error) => {
                console.error('[LiveVoice] WebSocket error:', error);
                this.setStatus('error');
                this.callbacks?.onError('Voice connection error. Please try again.');
            };

            this.ws.onclose = (event) => {
                console.log('[LiveVoice] WebSocket closed:', event.code, event.reason || 'No reason');
                this.cleanup();
                if (this._status !== 'error') {
                    this.setStatus('idle');
                }
                this.callbacks?.onDisconnect();
            };

            // Wait for the connection to be established and setup response received
            await this.waitForSetupComplete();

            // 4. Start microphone capture
            await this.startAudioCapture();
            this.setStatus('listening');
            this.resetIdleTimeout();

        } catch (error: any) {
            console.error('[LiveVoice] Connection failed:', error);
            this.setStatus('error');
            this.callbacks?.onError(error.message || 'Failed to connect to voice service');
            this.cleanup();
        }
    }

    private waitForSetupComplete(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.ws?.removeEventListener('close', onEarlyClose);
                reject(new Error('Setup timeout - no response from server'));
            }, 10000);

            const onEarlyClose = (event: CloseEvent) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket closed during setup (Code: ${event.code}, Reason: ${event.reason || 'None'})`));
            };
            this.ws?.addEventListener('close', onEarlyClose, { once: true });

            const originalHandler = this.ws!.onmessage;
            this.ws!.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.setupComplete) {
                        clearTimeout(timeout);
                        this.ws?.removeEventListener('close', onEarlyClose);
                        this.ws!.onmessage = originalHandler;
                        console.log('[LiveVoice] Setup complete');
                        resolve();
                    }
                } catch (e) {
                    // Ignore parse errors during setup
                }
            };
        });
    }

    /**
     * Handle incoming WebSocket messages.
     */
    private async handleMessage(event: MessageEvent) {
        try {
            const response = JSON.parse(event.data);

            // Handle audio output from the model
            if (response.serverContent) {
                const serverContent = response.serverContent;

                // Audio data
                if (serverContent.modelTurn?.parts) {
                    for (const part of serverContent.modelTurn.parts) {
                        if (part.inlineData?.data) {
                            this.setStatus('speaking');
                            this.clearIdleTimeout();
                            this.queueAudioChunk(part.inlineData.data);
                        }
                    }
                }

                // Input transcription (what the user said)
                if (serverContent.inputTranscription?.text) {
                    this.accumulatedInputTranscript += serverContent.inputTranscription.text;
                }

                // Output transcription (what the AI said)
                if (serverContent.outputTranscription?.text) {
                    this.accumulatedOutputTranscript += serverContent.outputTranscription.text;
                }

                // Model turn complete
                if (serverContent.turnComplete) {
                    // Flush accumulated transcripts
                    if (this.accumulatedInputTranscript.trim()) {
                        this.callbacks?.onInputTranscription(this.accumulatedInputTranscript.trim());
                        this.accumulatedInputTranscript = '';
                    }
                    if (this.accumulatedOutputTranscript.trim()) {
                        this.callbacks?.onOutputTranscription(this.accumulatedOutputTranscript.trim());
                        this.accumulatedOutputTranscript = '';
                    }
                    
                    // After AI finishes speaking, go back to listening
                    // Give a small delay for audio playback to complete
                    setTimeout(() => {
                        if (this._status === 'speaking') {
                            this.setStatus('listening');
                            this.resetIdleTimeout();
                        }
                    }, 500);
                }

                // Interruption detected (barge-in)
                if (serverContent.interrupted) {
                    console.log('[LiveVoice] Barge-in detected, stopping playback');
                    this.stopPlayback();
                    this.setStatus('listening');
                    this.clearIdleTimeout();
                }
            }

            // Handle tool calls
            if (response.toolCall) {
                await this.handleToolCall(response.toolCall);
            }

        } catch (e) {
            console.error('[LiveVoice] Error parsing message:', e);
        }
    }

    /**
     * Handle function calls from the Live API model.
     */
    private async handleToolCall(toolCall: any) {
        this.setStatus('thinking');
        this.startThinkingSound();

        // Flush the input transcript before processing
        if (this.accumulatedInputTranscript.trim()) {
            this.callbacks?.onInputTranscription(this.accumulatedInputTranscript.trim());
            this.accumulatedInputTranscript = '';
        }

        const functionResponses: any[] = [];

        for (const fc of (toolCall.functionCalls || [])) {
            try {
                const result = await this.callbacks?.onToolCall(fc.name, fc.args || {});
                functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: result || "Action processed successfully." }
                });
            } catch (error: any) {
                console.error(`[LiveVoice] Tool call "${fc.name}" failed:`, error);
                functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: "The game engine encountered an issue processing this action. Please describe what happened narratively." }
                });
            }
        }

        this.stopThinkingSound();

        // Send tool responses back
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const toolResponseMessage = {
                toolResponse: { functionResponses }
            };
            this.ws.send(JSON.stringify(toolResponseMessage));
        }
    }

    /**
     * Start capturing audio from the microphone and streaming to the WebSocket.
     */
    private async startAudioCapture(): Promise<void> {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000
        });

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        
        // Use ScriptProcessorNode for PCM capture (AudioWorklet would be better but requires module setup)
        this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.processorNode.onaudioprocess = (event) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const inputData = event.inputBuffer.getChannelData(0);
                const pcm16 = this.float32ToPcm16(inputData);
                const base64Data = this.arrayBufferToBase64(pcm16.buffer);

                const audioMessage = {
                    realtimeInput: {
                        mediaChunks: [{
                            data: base64Data,
                            mimeType: "audio/pcm;rate=16000"
                        }]
                    }
                };
                
                this.ws.send(JSON.stringify(audioMessage));
            }
        };

        source.connect(this.processorNode);
        this.processorNode.connect(this.audioContext.destination);
    }

    /**
     * Queue a base64-encoded PCM audio chunk for playback.
     */
    private queueAudioChunk(base64Data: string) {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Decode PCM16 to Float32
        const pcm16 = new Int16Array(bytes.buffer as ArrayBuffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768.0;
        }

        this.playAudioBuffer(float32, 24000); // Live API outputs at 24kHz
    }

    /**
     * Play a Float32 audio buffer through the AudioContext.
     */
    private playAudioBuffer(data: Float32Array, sampleRate: number) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        }

        const ctx = this.audioContext;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const buffer = ctx.createBuffer(1, data.length, sampleRate);
        buffer.getChannelData(0).set(data);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        this.activeSources.add(source);
        source.onended = () => {
            this.activeSources.delete(source);
        };

        const startTime = Math.max(ctx.currentTime, this.nextPlayTime);
        source.start(startTime);
        this.nextPlayTime = startTime + buffer.duration;
    }

    /**
     * Stop all audio playback immediately (for barge-in).
     */
    private stopPlayback() {
        this.activeSources.forEach(source => {
            try {
                source.onended = null;
                source.stop();
                source.disconnect();
            } catch (e) { /* ignore */ }
        });
        this.activeSources.clear();
        this.nextPlayTime = 0;
        this.playbackQueue = [];
    }

    /**
     * Start a subtle thinking sound.
     */
    private startThinkingSound() {
        if (!this.audioContext || this.audioContext.state === 'closed') return;
        
        try {
            const ctx = this.audioContext;
            if (ctx.state === 'suspended') ctx.resume();

            this.thinkingGain = ctx.createGain();
            this.thinkingGain.gain.setValueAtTime(0, ctx.currentTime);
            this.thinkingGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.5);
            this.thinkingGain.connect(ctx.destination);

            this.thinkingOscillator = ctx.createOscillator();
            this.thinkingOscillator.type = 'sine';
            this.thinkingOscillator.frequency.setValueAtTime(220, ctx.currentTime);
            
            // Subtle pulse effect
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.value = 1.5; // Slow pulse
            lfoGain.gain.value = 0.015;
            lfo.connect(lfoGain);
            lfoGain.connect(this.thinkingOscillator!.frequency);
            lfo.start();

            this.thinkingOscillator.connect(this.thinkingGain);
            this.thinkingOscillator.start();
        } catch (e) {
            // Thinking sound is non-critical
            console.warn('[LiveVoice] Could not start thinking sound:', e);
        }
    }

    /**
     * Stop the thinking sound.
     */
    private stopThinkingSound() {
        try {
            if (this.thinkingOscillator) {
                this.thinkingOscillator.stop();
                this.thinkingOscillator.disconnect();
                this.thinkingOscillator = null;
            }
            if (this.thinkingGain) {
                this.thinkingGain.disconnect();
                this.thinkingGain = null;
            }
        } catch (e) { /* ignore */ }
    }

    /**
     * Disconnect from the Live API and cleanup all resources.
     */
    disconnect() {
        this.cleanup();
        this.setStatus('idle');
    }

    /**
     * Internal cleanup of all resources.
     */
    private cleanup() {
        this.clearIdleTimeout();
        this.stopPlayback();
        this.stopThinkingSound();

        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }

        // Keep audioContext open for reuse, but reset timeline
        this.nextPlayTime = 0;
        this.accumulatedInputTranscript = '';
        this.accumulatedOutputTranscript = '';
    }

    // --- Idle Timeout ---

    private resetIdleTimeout() {
        this.clearIdleTimeout();
        this.idleTimeoutId = setTimeout(() => {
            console.log('[LiveVoice] Idle timeout reached, disconnecting...');
            this.disconnect();
            this.callbacks?.onDisconnect();
        }, this.idleTimeoutMs);
    }

    private clearIdleTimeout() {
        if (this.idleTimeoutId) {
            clearTimeout(this.idleTimeoutId);
            this.idleTimeoutId = null;
        }
    }

    // --- Audio Utilities ---

    private float32ToPcm16(float32Array: Float32Array): Int16Array {
        const pcm16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return pcm16;
    }

    private arrayBufferToBase64(buffer: ArrayBufferLike): string {
        const bytes = new Uint8Array(buffer as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}

// Singleton instance
export const liveVoiceService = new LiveVoiceService();
