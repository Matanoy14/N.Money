import React, { useState, useEffect, useRef } from 'react';

interface VoiceExpenseButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type RecordingStatus = 'idle' | 'recording' | 'unsupported';

const VoiceExpenseButton: React.FC<VoiceExpenseButtonProps> = ({ onTranscript, disabled }) => {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setStatus('unsupported');
    }
  }, []);

  const startRecording = () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    setErrorMsg(null);
    if (recRef.current) {
      recRef.current.abort();
    }

    const rec = new SpeechRecognitionAPI();
    rec.lang = 'he-IL';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript).join('');
      setInterimText(transcript);
      if (e.results[0].isFinal) {
        onTranscript(transcript);
        setStatus('idle');
        setInterimText('');
      }
    };
    rec.onerror = (e: any) => {
      setStatus('idle');
      setInterimText('');
      const code = e?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setErrorMsg('יש לאשר גישה למיקרופון');
      } else if (code !== 'no-speech' && code !== 'aborted') {
        setErrorMsg('ההקלטה נכשלה — נסה שוב');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    };
    rec.onend = () => { setStatus('idle'); setInterimText(''); };

    recRef.current = rec;
    rec.start();
    setStatus('recording');
  };

  const stopRecording = () => {
    if (recRef.current) {
      recRef.current.stop();
    }
    setStatus('idle');
    setInterimText('');
  };

  if (status === 'unsupported') {
    return (
      <button
        disabled
        title="לא נתמך בדפדפן זה — השתמש ב-Chrome או Safari"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold opacity-40 cursor-not-allowed"
        style={{ backgroundColor: '#6B7280', color: '#fff' }}
      >
        <span>🎤</span> הכתב בקול
      </button>
    );
  }

  if (status === 'recording') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-600 font-semibold">מקשיב...</span>
          <button
            onClick={stopRecording}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            עצור
          </button>
        </div>
        {interimText && (
          <p className="text-xs text-gray-500 italic max-w-[280px] truncate">"{interimText}"</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={startRecording}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        style={{ backgroundColor: '#1E56A0', color: '#fff' }}
      >
        <span>🎤</span> הכתב בקול
      </button>
      {errorMsg && (
        <p className="text-[10px] text-red-500 leading-none">{errorMsg}</p>
      )}
    </div>
  );
};

export default VoiceExpenseButton;
