import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Volume2, AlertCircle } from 'lucide-react';

export default function VoiceNoteRecorder({ onAudioRecorded, existingAudioUrl = null }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(existingAudioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio recording is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert Blob to Base64 data URL so it can be stored & sent to backend easily
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result;
          setAudioUrl(base64data);
          if (onAudioRecorded) {
            onAudioRecorded({
              audioUrl: base64data,
              duration: recordingTime,
            });
          }
        };

        // Stop all tracks on the stream to release microphone hardware
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            // Cap recording at 60s
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('Microphone access error:', err);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. (Voice note is optional - you can type below).'
          : 'Could not access microphone on this device.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDiscard = () => {
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
    if (onAudioRecorded) {
      onAudioRecorded(null);
    }
  };

  const togglePlayAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] transition-all">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-[#0F172A] flex items-center space-x-1.5">
          <Mic className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>Quick Voice Note (Optional)</span>
        </label>
        <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
          {isRecording ? 'Recording...' : audioUrl ? 'Voice Note Ready' : 'Speak to explain'}
        </span>
      </div>

      {errorMsg && (
        <div className="mb-2 p-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[11px] text-[#991B1B] flex items-center space-x-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* State 1: Ready to record */}
      {!isRecording && !audioUrl && (
        <button
          type="button"
          onClick={startRecording}
          className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#CBD5E1] hover:border-[#2563EB] text-[#0F172A] text-xs font-bold flex items-center justify-center space-x-2 shadow-sm hover:shadow transition group cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center group-hover:scale-110 transition">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <span>Tap to Record Voice Note</span>
        </button>
      )}

      {/* State 2: Active Recording */}
      {isRecording && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA]">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <span className="font-mono text-xs font-extrabold text-[#991B1B]">
              {formatTime(recordingTime)} / 01:00
            </span>
            {/* Animated Waveform Bars */}
            <div className="flex items-center space-x-0.5 h-4">
              <span className="w-1 bg-red-500 rounded-full animate-bounce h-3" style={{ animationDelay: '0ms' }} />
              <span className="w-1 bg-red-500 rounded-full animate-bounce h-5" style={{ animationDelay: '150ms' }} />
              <span className="w-1 bg-red-500 rounded-full animate-bounce h-2" style={{ animationDelay: '300ms' }} />
              <span className="w-1 bg-red-500 rounded-full animate-bounce h-4" style={{ animationDelay: '450ms' }} />
            </div>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="px-3 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop Recording</span>
          </button>
        </div>
      )}

      {/* State 3: Recorded Audio Preview */}
      {audioUrl && !isRecording && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#CBD5E1] shadow-sm">
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={togglePlayAudio}
              className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#2563EB] hover:text-white flex items-center justify-center transition shadow-sm"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <div>
              <div className="text-xs font-extrabold text-[#0F172A] flex items-center space-x-1">
                <Volume2 className="w-3 h-3 text-[#2563EB]" />
                <span>Voice Memo Attached</span>
              </div>
              <div className="text-[10px] text-[#64748B] font-mono">
                {formatTime(recordingTime || 5)} duration
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDiscard}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition"
            title="Discard and re-record"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
