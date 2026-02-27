import React, { useState, useEffect, useRef, useContext } from 'react';
import { Icon } from './Icon';
import { transcribeAudio, refineTranscription } from '../services/geminiService';
import { GameDataContext } from '../context/GameDataContext';

// --- Modal Component ---
interface SpeechToTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendTranscript: (transcript: string) => void;
  onStateChange?: (state: 'idle' | 'recording' | 'transcribing' | 'refining') => void;
}

export const SpeechToTextModal: React.FC<SpeechToTextModalProps> = ({ isOpen, onClose, onSendTranscript, onStateChange }) => {
  const { gameData } = useContext(GameDataContext);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'transcribing' | 'refining'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateState = (newState: 'idle' | 'recording' | 'transcribing' | 'refining') => {
      setRecordingState(newState);
      if (onStateChange) onStateChange(newState);
  };

  const resetState = () => {
    updateState('idle');
    setError(null);
    audioChunksRef.current = [];
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
  };

  const handleClose = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    resetState();
    onClose();
  };

  const startRecording = async () => {
    if (recordingState === 'recording') return;
    
    resetState();
    updateState('idle'); // Wait for settle

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // CULPRIT FIX: Add a small delay for hardware to "settle" before recording starts.
        // This prevents the first-attempt buffer silence issue.
        settleTimeoutRef.current = setTimeout(() => {
            updateState('recording');
            const options = { mimeType: 'audio/webm;codecs=opus' };
            const mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
            mediaRecorderRef.current = mediaRecorder;
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Ensure all tracks are stopped immediately
                stream.getTracks().forEach(track => track.stop());

                if (audioChunksRef.current.length === 0) {
                    setError("No audio detected. Please try again.");
                    return;
                }

                updateState('transcribing');
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                
                // Debug blob size
                if (audioBlob.size < 100) {
                    setError("Input too short. Please speak clearly.");
                    updateState('idle');
                    return;
                }

                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64data = reader.result as string;
                    const base64Audio = base64data.split(',')[1];

                    try {
                        const transcript = await transcribeAudio(base64Audio, 'audio/webm');
                        if (transcript && transcript.trim().length > 0) {
                            // REFINEMENT STEP
                            if (gameData) {
                                updateState('refining');
                                const refined = await refineTranscription(transcript.trim(), gameData.messages, gameData);
                                // Validation: Ensure we actually have content before sending
                                if (refined && refined.trim()) {
                                    onSendTranscript(refined.trim());
                                    handleClose();
                                } else {
                                    setError("Could not process speech. Try again.");
                                }
                            } else {
                                onSendTranscript(transcript.trim());
                                handleClose();
                            }
                        } else {
                            setError('No speech recognized. Please try again.');
                            updateState('idle');
                        }
                    } catch (err) {
                        setError('Transcription failed. Check your connection.');
                        console.error(err);
                        updateState('idle');
                    }
                };
            };
            
            mediaRecorder.start();
        }, 250); 
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
        setError('Microphone access denied. Please enable it in browser settings.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    if (isOpen) {
        startRecording();
    } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        resetState();
    }
    return () => {
        if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const renderContent = () => {
      if (error) {
           return (
              <>
                  <h4 className="text-red-400">Audio Error</h4>
                  <div className="w-full min-h-[80px] bg-brand-primary p-4 rounded-xl text-body-sm flex items-center justify-center">
                      <p className="text-red-400 text-center">{error}</p>
                  </div>
                  <div className="flex w-full justify-center items-center mt-2 gap-4">
                      <button onClick={startRecording} className="btn-primary btn-md px-6 rounded-lg">
                          Retry
                      </button>
                      <button onClick={handleClose} className="btn-secondary btn-md px-6 rounded-lg border-brand-primary text-brand-text-muted">
                          Cancel
                      </button>
                  </div>
              </>
          );
      }

      switch(recordingState) {
          case 'refining':
          case 'transcribing':
              return (
                   <>
                      <h4 className="text-brand-accent">{recordingState === 'refining' ? 'Refining Intent...' : 'Transcribing...'}</h4>
                      <div className="w-28 h-28 flex items-center justify-center">
                          <Icon name="spinner" className="w-16 h-16 text-brand-accent animate-spin" />
                      </div>
                      <p className="text-body-sm text-brand-text-muted animate-pulse">
                        {recordingState === 'refining' ? 'Polishing speech with world context...' : 'Consulting the weave...'}
                      </p>
                  </>
              );
          case 'recording':
              return (
                  <>
                      <h4 className="text-brand-accent">Listening...</h4>
                      <button 
                          onClick={stopRecording}
                          className="relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 bg-brand-accent active:scale-95 shadow-[0_0_30px_rgba(62,207,142,0.3)]"
                          aria-label="Stop recording"
                      >
                          <Icon name="microphone" className="w-12 h-12 text-black" />
                          <div className="absolute inset-0 rounded-full border-4 border-brand-accent/50" style={{ animation: 'pulse 2s infinite' }}></div>
                      </button>
                      <p className="text-body-sm text-brand-text-muted">Tap to finish speaking.</p>
                  </>
              );
          case 'idle':
          default:
              return (
                  <>
                      <h4 className="text-brand-text-muted opacity-50">Initializing...</h4>
                      <div className="w-28 h-28 flex items-center justify-center">
                          <Icon name="spinner" className="w-10 h-10 text-brand-primary animate-spin" />
                      </div>
                      <p className="text-body-sm text-brand-text-muted italic">Preparing audio stream...</p>
                  </>
              );
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[150] p-4 backdrop-blur-sm transition-all duration-300" onClick={handleClose}>
      <div className="bg-brand-surface rounded-3xl shadow-2xl w-full max-w-sm p-8 border border-brand-primary flex flex-col items-center gap-6 animate-modal" onClick={e => e.stopPropagation()}>
        {renderContent()}
        <style>{`
            @keyframes pulse {
              0% { transform: scale(0.95); opacity: 0.8; }
              70% { transform: scale(1.15); opacity: 0; }
              100% { transform: scale(0.95); opacity: 0; }
            }
        `}</style>
      </div>
    </div>
  );
};


// --- Main Button Component ---
interface SpeechToTextButtonProps {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({ onClick, className }) => {
  const isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  if (!isSupported) {
    return null;
  }

  return (
      <button
        type="button"
        onClick={onClick}
        className={`${className || ''} btn-icon hover:bg-brand-primary text-brand-text-muted hover:text-brand-text`}
        aria-label="Start voice input"
      >
        <Icon name="microphone" className="w-5 h-5" />
      </button>
  );
};

export default SpeechToTextButton;
