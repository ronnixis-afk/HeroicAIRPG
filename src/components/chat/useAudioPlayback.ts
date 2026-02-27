import { useState, useRef, useEffect, useCallback } from 'react';
import { generateSpeech } from '../../services/aiNarratorService';

/**
 * Manually implement base64 decoding per Gemini API security and performance guidelines.
 * Standardizes the handling of raw PCM data from the Neural TTS model.
 */
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM 16-bit data into Float32 format for the Web Audio API.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const useAudioPlayback = (useAiTts: boolean, voiceName: string, tone: string) => {
    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    // The nextStartTime acts as a cursor to track the end of the audio playback queue.
    const nextStartTimeRef = useRef<number>(0);

    const stopAllSpeech = useCallback(() => {
        // 1. Terminate all active AI Neural TTS sources
        activeSourcesRef.current.forEach(source => {
            try {
                source.onended = null;
                source.stop();
                source.disconnect();
            } catch (e) {}
        });
        activeSourcesRef.current.clear();
        
        // 2. Reset the timeline cursor
        nextStartTimeRef.current = 0;

        // 3. Cancel native browser SpeechSynthesis
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        // 4. Update UI State
        setPlayingMessageId(null);
        setIsSpeaking(false);
    }, []);

    const speak = useCallback(async (text: string, id: string) => {
        if (!text) return;
        
        // Toggle logic: If clicking/triggering the currently playing message, stop it.
        // Important: We use the ref-style check in effects to prevent double-triggering
        if (playingMessageId === id) {
            stopAllSpeech();
            return;
        }
        
        // Ensure clean slate before starting new narration
        stopAllSpeech();
        
        setPlayingMessageId(id);
        setIsSpeaking(true);

        if (useAiTts) {
            try {
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                
                const ctx = audioContextRef.current;
                if (ctx.state === 'suspended') {
                    await ctx.resume();
                }

                const base64Audio = await generateSpeech(text, voiceName, tone);
                
                if (base64Audio && ctx) {
                    const audioBytes = decode(base64Audio);
                    const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
                    
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    
                    activeSourcesRef.current.add(source);
                    
                    source.onended = () => {
                        activeSourcesRef.current.delete(source);
                        if (activeSourcesRef.current.size === 0) {
                            setPlayingMessageId(null);
                            setIsSpeaking(false);
                            nextStartTimeRef.current = 0;
                        }
                    };

                    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + audioBuffer.duration;
                }
            } catch (err) {
                console.error("AI TTS playback failed:", err);
                stopAllSpeech();
            }
        } else {
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            
            if (voiceName.includes('Female')) {
                const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Google UK English Female') || v.name.includes('Samantha'));
                if (femaleVoice) utterance.voice = femaleVoice;
            } else {
                const maleVoice = voices.find(v => v.name.includes('Male') || v.name.includes('Google UK English Male') || v.name.includes('Daniel'));
                if (maleVoice) utterance.voice = maleVoice;
            }
            
            utterance.rate = 0.95;
            utterance.pitch = 1.0;
            utterance.onend = () => {
                setPlayingMessageId(null);
                setIsSpeaking(false);
            };
            
            window.speechSynthesis.speak(utterance);
        }
    }, [playingMessageId, stopAllSpeech, useAiTts, voiceName, tone]);

    useEffect(() => {
        return () => {
            stopAllSpeech();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, [stopAllSpeech]);

    return { speak, stopAllSpeech, playingMessageId, isSpeaking };
};