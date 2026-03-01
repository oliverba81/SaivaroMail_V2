'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiPaperclip, FiDownload, FiMail, FiVolume2, FiPause, FiPlay, FiPhone } from 'react-icons/fi';
import { getDisplayFrom, getDisplayFromLabel } from '@/utils/email-helpers';
import { normalizePhoneNumberForTel, formatPhoneNumberForDisplay } from '@/utils/phone-utils';
import { useToast } from '@/components/ToastProvider';
import EmailThreadView from './EmailThreadView';

interface Email {
  id: string;
  ticketId?: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body?: string; // Optional, wird lazy geladen
  date: string;
  read: boolean;
  hasAttachment?: boolean;
  isConversationThread?: boolean;
  conversationMessageCount?: number;
  type?: 'email' | 'phone_note';
  phoneNumber?: string;
}

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

interface EmailPreviewProps {
  email: Email | null;
  loading: boolean;
  onMarkAsRead: (read: boolean) => void;
  markingRead: boolean;
  formatDate: (dateString: string) => string;
  onDelete?: () => void;
  showThreadView?: boolean;
  onReplyToEmail?: (emailId: string) => void;
  currentUserId?: string | null;
}

export default function EmailPreview({
  email,
  loading,
  onMarkAsRead: _onMarkAsRead,
  markingRead: _markingRead,
  formatDate,
  onDelete: _onDelete,
  showThreadView = false,
  onReplyToEmail,
  currentUserId,
}: EmailPreviewProps) {
  const router = useRouter();
  const toast = useToast();
  const [emailBody, setEmailBody] = useState<string>('');
  const [loadingBody, setLoadingBody] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // TTS & Summary States
  const [features, setFeatures] = useState({ textToSpeech: false, emailSummary: false, audioFeatures: false });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loadingTTS, setLoadingTTS] = useState(false);
  const [_currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [ttsProvider, setTtsProvider] = useState<'browser' | 'elevenlabs' | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const hasStartedRef = useRef(false);

  // Lade Body lazy, wenn E-Mail ausgewählt ist aber Body fehlt
  useEffect(() => {
    if (email && !email.body && email.id) {
      loadEmailBody();
    } else if (email?.body) {
      setEmailBody(email.body);
    } else {
      setEmailBody('');
    }
  }, [email?.id, email?.body]);

  // Lade Feature-Flags beim Mount
  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const token = localStorage.getItem('mailclient_token');
        if (!token) {
          console.warn('EmailPreview: Kein Token gefunden, Features werden nicht geladen');
          return;
        }
        
        const response = await fetch('/api/company/features', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('EmailPreview: Features geladen:', data.features);
          // audioFeatures aktiviert beide Funktionen
          const audioFeatures = data.features?.audioFeatures ?? 
                               (data.features?.textToSpeech && data.features?.emailSummary) ?? 
                               false;
          setFeatures({
            textToSpeech: audioFeatures || data.features?.textToSpeech || false,
            emailSummary: audioFeatures || data.features?.emailSummary || false,
            audioFeatures: audioFeatures,
          });
        } else {
          console.error('EmailPreview: Fehler beim Laden der Features:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('EmailPreview: Fehler beim Laden der Feature-Flags:', error);
      }
    };
    
    loadFeatures();
  }, []);

  // Lade Anhänge wenn E-Mail ausgewählt ist
  useEffect(() => {
    if (email?.id) {
      loadAttachments();
    } else {
      setAttachments([]);
    }
  }, [email?.id]);

  const loadEmailBody = async () => {
    if (!email?.id) return;
    
    try {
      setLoadingBody(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) {
        return;
      }

      const response = await fetch(`/api/emails/${email.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const body = data.email?.body || '';
        setEmailBody(body);
      }
    } catch (err) {
      console.error('Fehler beim Laden des E-Mail-Bodies:', err);
      setEmailBody('(Fehler beim Laden des Inhalts)');
    } finally {
      setLoadingBody(false);
    }
  };

  const loadAttachments = async () => {
    if (!email?.id) return;
    
    try {
      setLoadingAttachments(true);
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch(`/api/emails/${email.id}/attachments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAttachments(data.attachments || []);
      } else {
        console.error('Fehler beim Laden der Anhänge:', response.status, response.statusText);
        setAttachments([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Anhänge:', err);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleTextToSpeech = async () => {
    if (!email?.id) return;
    
    setLoadingTTS(true);
    
    try {
      // Prüfe, ob Body vorhanden ist
      let bodyToUse = emailBody;
      if (!bodyToUse) {
        if (loadingBody) {
          setLoadingTTS(false);
          return;
        }
        await loadEmailBody();
        bodyToUse = emailBody;
      }
      
      if (!bodyToUse || bodyToUse.trim() === '') {
        toast.showError('Kein Text zum Vorlesen vorhanden.');
        setLoadingTTS(false);
        return;
      }
      
      // Text bereinigen
      const cleanText = bodyToUse
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!cleanText) {
        toast.showError('Kein Text zum Vorlesen vorhanden.');
        setLoadingTTS(false);
        return;
      }
      
      // Prüfe, ob ElevenLabs verfügbar ist
      try {
        const token = localStorage.getItem('mailclient_token');
        const configResponse = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.settings?.elevenlabsApiKey && configData.settings?.elevenlabsEnabled) {
            // Verwende ElevenLabs
            setTtsProvider('elevenlabs');
            const audio = new Audio();
            
            // Erstelle URL mit Token für Authorization
            const audioUrl = `/api/emails/${email.id}/text-to-speech`;
            
            // Lade Audio mit Fetch, um Authorization-Header hinzuzufügen
            try {
              const audioResponse = await fetch(audioUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              
              if (!audioResponse.ok) {
                // Prüfe Content-Type, um zu sehen, ob es JSON oder Audio ist
                const contentType = audioResponse.headers.get('content-type');
                let errorMessage = 'Fehler beim Laden der Audio-Datei. Verwende Browser-TTS.';
                
                if (contentType?.includes('application/json')) {
                  try {
                    const errorData = await audioResponse.json();
                    errorMessage = errorData.error || errorMessage;
                  } catch {
                    // Ignoriere JSON-Parse-Fehler
                  }
                } else {
                  errorMessage = `Fehler beim Laden der Audio-Datei (${audioResponse.status} ${audioResponse.statusText}). Verwende Browser-TTS.`;
                }
                
                console.error('ElevenLabs Audio-Fehler:', {
                  status: audioResponse.status,
                  statusText: audioResponse.statusText,
                  contentType,
                });
                
                toast.showError(errorMessage);
                setLoadingTTS(false);
                handleBrowserTTS(cleanText);
                return;
              }
              
              // Prüfe, ob die Response wirklich Audio ist
              const contentType = audioResponse.headers.get('content-type');
              if (!contentType?.includes('audio')) {
                console.error('Unerwarteter Content-Type:', contentType);
                toast.showError('Unerwartetes Antwortformat. Verwende Browser-TTS.');
                setLoadingTTS(false);
                handleBrowserTTS(cleanText);
                return;
              }
              
              // Erstelle Blob-URL aus Response
              const audioBlob = await audioResponse.blob();
              
              if (audioBlob.size === 0) {
                console.error('Audio-Blob ist leer');
                toast.showError('Audio-Datei ist leer. Verwende Browser-TTS.');
                setLoadingTTS(false);
                handleBrowserTTS(cleanText);
                return;
              }
              
              const audioBlobUrl = URL.createObjectURL(audioBlob);
              
              audio.src = audioBlobUrl;
              audio.onloadeddata = () => {
                setLoadingTTS(false);
                audio.play();
                setIsPlaying(true);
                setCurrentAudio(audio);
              };
              audio.onended = () => {
                setIsPlaying(false);
                setIsPaused(false);
                setCurrentAudio(null);
                URL.revokeObjectURL(audioBlobUrl); // Cleanup
              };
              audio.onerror = (e) => {
                console.error('Audio-Fehler beim Abspielen:', e, {
                  error: audio.error,
                  networkState: audio.networkState,
                  readyState: audio.readyState,
                });
                setLoadingTTS(false);
                toast.showError('Fehler beim Abspielen der Audio-Datei. Verwende Browser-TTS.');
                URL.revokeObjectURL(audioBlobUrl); // Cleanup
                handleBrowserTTS(cleanText);
              };
              return;
            } catch (fetchError: any) {
              console.error('Fehler beim Laden der Audio-Datei:', fetchError, {
                message: fetchError.message,
                stack: fetchError.stack,
              });
              setLoadingTTS(false);
              toast.showError(`Fehler beim Laden der Audio-Datei: ${fetchError.message || 'Unbekannter Fehler'}. Verwende Browser-TTS.`);
              handleBrowserTTS(cleanText);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Fehler beim Prüfen der ElevenLabs-Config:', err);
        setLoadingTTS(false);
      }
      
      // Fallback auf Browser-TTS
      setLoadingTTS(false);
      handleBrowserTTS(cleanText);
    } catch (error: any) {
      console.error('Fehler beim Vorlesen:', error);
      setLoadingTTS(false);
      toast.showError('Fehler beim Vorlesen. Bitte versuchen Sie es erneut.');
    }
  };
  
  const handleBrowserTTS = (cleanText: string) => {
    if (!('speechSynthesis' in window)) {
      toast.showError('Text-to-Speech wird von Ihrem Browser nicht unterstützt.');
      return;
    }
    
    setTtsProvider('browser');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'de-DE';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const getGermanVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      return voices.find(v => v.lang.startsWith('de'));
    };
    
    let germanVoice = getGermanVoice();
    hasStartedRef.current = false;
    
    if (!germanVoice) {
      const onVoicesChanged = () => {
        if (hasStartedRef.current) return;
        germanVoice = getGermanVoice();
        if (germanVoice) {
          utterance.voice = germanVoice;
          window.speechSynthesis.speak(utterance);
          hasStartedRef.current = true;
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        }
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      setTimeout(() => {
        if (hasStartedRef.current) return;
        germanVoice = getGermanVoice();
        if (germanVoice) {
          utterance.voice = germanVoice;
        }
        window.speechSynthesis.speak(utterance);
        hasStartedRef.current = true;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      }, 100);
    } else {
      utterance.voice = germanVoice;
      window.speechSynthesis.speak(utterance);
      hasStartedRef.current = true;
    }
    
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentUtterance(null);
      hasStartedRef.current = false;
    };
    
    utterance.onerror = (event) => {
      toast.showError('Fehler beim Vorlesen: ' + event.error);
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentUtterance(null);
      hasStartedRef.current = false;
    };
    
    setCurrentUtterance(utterance);
    setIsPlaying(true);
  };
  
  const handlePauseResume = () => {
    if (ttsProvider === 'elevenlabs' && currentAudio) {
      if (isPlaying && !isPaused) {
        currentAudio.pause();
        setIsPaused(true);
      } else if (isPaused) {
        currentAudio.play();
        setIsPaused(false);
      }
    } else if (ttsProvider === 'browser') {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setIsPaused(true);
      } else if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      }
    }
  };
  
  const handleStop = () => {
    if (ttsProvider === 'elevenlabs' && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentAudio(null);
    } else if (ttsProvider === 'browser') {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentUtterance(null);
      hasStartedRef.current = false;
    }
  };
  
  const handleSummarize = async () => {
    if (!email?.id) return;
    
    // Prüfe, ob Body vorhanden ist
    let bodyToUse = emailBody;
    if (!bodyToUse) {
      if (loadingBody) return;
      await loadEmailBody();
      bodyToUse = emailBody;
    }
    
    if (!bodyToUse || bodyToUse.trim() === '') {
      toast.showError('E-Mail-Inhalt ist leer');
      return;
    }
    
    setLoadingSummary(true);
    try {
      const token = localStorage.getItem('mailclient_token');
      const response = await fetch(`/api/emails/${email.id}/summarize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.status === 401) {
        localStorage.removeItem('mailclient_token');
        localStorage.removeItem('mailclient_user');
        router.push('/login');
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.showError(errorData.error || 'Fehler beim Erstellen der Zusammenfassung');
        return;
      }
      
      const data = await response.json();
      const summaryText = data.summary;
      
      if (!summaryText || summaryText.trim() === '') {
        toast.showError('Zusammenfassung ist leer.');
        return;
      }
      
      // Text bereinigen
      const cleanText = summaryText
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!cleanText) {
        toast.showError('Zusammenfassung ist leer.');
        return;
      }
      
      // Prüfe, ob ElevenLabs verfügbar ist
      try {
        const configResponse = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.settings?.elevenlabsApiKey && configData.settings?.elevenlabsEnabled) {
            // Verwende ElevenLabs für die Zusammenfassung
            setTtsProvider('elevenlabs');
            const audio = new Audio();
            
            // Lade Audio mit Fetch, um Authorization-Header hinzuzufügen
            try {
              const audioResponse = await fetch('/api/text-to-speech', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: cleanText }),
              });
              
              if (!audioResponse.ok) {
                // Prüfe Content-Type, um zu sehen, ob es JSON oder Audio ist
                const contentType = audioResponse.headers.get('content-type');
                let errorMessage = 'Fehler beim Laden der Audio-Datei. Verwende Browser-TTS.';
                
                if (contentType?.includes('application/json')) {
                  try {
                    const errorData = await audioResponse.json();
                    errorMessage = errorData.error || errorMessage;
                  } catch {
                    // Ignoriere JSON-Parse-Fehler
                  }
                } else {
                  errorMessage = `Fehler beim Laden der Audio-Datei (${audioResponse.status} ${audioResponse.statusText}). Verwende Browser-TTS.`;
                }
                
                console.error('ElevenLabs Audio-Fehler:', {
                  status: audioResponse.status,
                  statusText: audioResponse.statusText,
                  contentType,
                });
                
                toast.showError(errorMessage);
                handleBrowserTTS(cleanText);
                return;
              }
              
              // Prüfe, ob die Response wirklich Audio ist
              const contentType = audioResponse.headers.get('content-type');
              if (!contentType?.includes('audio')) {
                console.error('Unerwarteter Content-Type:', contentType);
                toast.showError('Unerwartetes Antwortformat. Verwende Browser-TTS.');
                handleBrowserTTS(cleanText);
                return;
              }
              
              // Erstelle Blob-URL aus Response
              const audioBlob = await audioResponse.blob();
              
              if (audioBlob.size === 0) {
                console.error('Audio-Blob ist leer');
                toast.showError('Audio-Datei ist leer. Verwende Browser-TTS.');
                handleBrowserTTS(cleanText);
                return;
              }
              
              const audioBlobUrl = URL.createObjectURL(audioBlob);
              
              audio.src = audioBlobUrl;
              audio.onloadeddata = () => {
                audio.play();
                setIsPlaying(true);
                setCurrentAudio(audio);
              };
              audio.onended = () => {
                setIsPlaying(false);
                setIsPaused(false);
                setCurrentAudio(null);
                URL.revokeObjectURL(audioBlobUrl); // Cleanup
              };
              audio.onerror = (e) => {
                console.error('Audio-Fehler beim Abspielen:', e, {
                  error: audio.error,
                  networkState: audio.networkState,
                  readyState: audio.readyState,
                });
                toast.showError('Fehler beim Abspielen der Audio-Datei. Verwende Browser-TTS.');
                URL.revokeObjectURL(audioBlobUrl); // Cleanup
                handleBrowserTTS(cleanText);
              };
              toast.showSuccess('Zusammenfassung wird vorgelesen.');
              return;
            } catch (fetchError: any) {
              console.error('Fehler beim Laden der Audio-Datei:', fetchError, {
                message: fetchError.message,
                stack: fetchError.stack,
              });
              toast.showError(`Fehler beim Laden der Audio-Datei: ${fetchError.message || 'Unbekannter Fehler'}. Verwende Browser-TTS.`);
              handleBrowserTTS(cleanText);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Fehler beim Prüfen der ElevenLabs-Config:', err);
      }
      
      // Fallback: Browser-TTS
      handleBrowserTTS(cleanText);
      toast.showSuccess('Zusammenfassung wird vorgelesen.');
    } catch (err: any) {
      toast.showError('Fehler beim Erstellen der Zusammenfassung');
      console.error('Fehler:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
    if (!email?.id) return;
    
    try {
      const token = localStorage.getItem('mailclient_token');
      if (!token) return;

      const response = await fetch(`/api/emails/${email.id}/attachments/${attachmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Fehler beim Download des Anhangs');
      }
    } catch (err) {
      console.error('Fehler beim Download des Anhangs:', err);
    }
  };
  if (loading) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '1rem', color: '#6c757d' }}>Lade E-Mail...</p>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <FiMail size={56} style={{ color: '#9CA3AF' }} />
          </div>
          <div className="empty-state-title">Keine E-Mail ausgewählt</div>
          <div className="empty-state-text">
            Wählen Sie eine E-Mail aus der Liste aus, um die Vorschau anzuzeigen.
          </div>
        </div>
      </div>
    );
  }

  // Zeige Thread-View wenn Toggle aktiv ist und E-Mail eine Ticket-ID hat
  if (showThreadView && email.ticketId) {
    return (
      <EmailThreadView
        emailId={email.id}
        formatDate={formatDate}
        onReplyToEmail={onReplyToEmail}
        currentUserId={currentUserId}
      />
    );
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* TTS & Summary Buttons */}
      {email && features.audioFeatures && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e9ecef' }}>
          <button
            onClick={isPlaying ? (isPaused ? handlePauseResume : handleStop) : handleTextToSpeech}
            disabled={loadingBody || loadingTTS}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: isPlaying ? '#f8f9fa' : '#fff',
              cursor: (loadingBody || loadingTTS) ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: (loadingBody || loadingTTS) ? 0.6 : 1,
            }}
          >
            {loadingTTS ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span>Wird vorbereitet...</span>
              </>
            ) : isPlaying ? (
              isPaused ? (
                <>
                  <FiPlay size={16} />
                  <span>Fortsetzen</span>
                </>
              ) : (
                <>
                  <FiPause size={16} />
                  <span>Pausieren</span>
                </>
              )
            ) : (
              <>
                <FiVolume2 size={16} />
                <span>Vorlesen</span>
              </>
            )}
          </button>
          <button
            onClick={handleSummarize}
            disabled={loadingSummary || loadingBody}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: (loadingSummary || loadingBody) ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: (loadingSummary || loadingBody) ? 0.6 : 1,
            }}
          >
            {loadingSummary ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                <span>Lädt...</span>
              </>
            ) : (
              <>
                <FiVolume2 size={16} />
                <span>Zusammenfassung wiedergeben</span>
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e9ecef', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
        <h2
          style={{
            fontSize: '0.95rem',
            fontWeight: '600',
            margin: 0,
            marginBottom: '0.4rem',
            color: '#333',
            lineHeight: '1.2',
          }}
        >
          {email.subject || '(Kein Betreff)'}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1rem', fontSize: '0.8rem', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
            <span style={{ fontWeight: '600', color: '#6c757d', fontSize: '0.8rem' }}>{getDisplayFromLabel(email)}</span>
            {email.type === 'phone_note' && email.phoneNumber ? (
              <a
                href={`tel:${normalizePhoneNumberForTel(email.phoneNumber)}`}
                style={{ color: '#007bff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                title={`Anrufen: ${formatPhoneNumberForDisplay(email.phoneNumber)}`}
              >
                <FiPhone size={14} style={{ color: '#007bff' }} />
                <span>{formatPhoneNumberForDisplay(email.phoneNumber)}</span>
              </a>
            ) : (
              <span style={{ color: '#333' }}>{getDisplayFrom(email) || email.from}</span>
            )}
          </div>
          {email.type !== 'phone_note' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <span style={{ fontWeight: '600', color: '#6c757d', fontSize: '0.8rem' }}>An:</span>
              <span style={{ color: '#333' }}>
                {Array.isArray(email.to) ? email.to.join(', ') : email.to}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
            <span style={{ fontWeight: '600', color: '#6c757d', fontSize: '0.8rem' }}>Datum:</span>
            <span style={{ color: '#6c757d' }}>{formatDate(email.date)}</span>
          </div>
          {email.ticketId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <span style={{ fontWeight: '600', color: '#6c757d', fontSize: '0.8rem' }}>Ticket-ID:</span>
              <span 
                style={{ 
                  color: '#007bff', 
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  backgroundColor: '#e7f1ff',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '3px',
                }}
              >
                {email.ticketId}
              </span>
              {email.isConversationThread && email.conversationMessageCount && email.conversationMessageCount > 1 && (
                <span 
                  style={{ 
                    color: '#6c757d', 
                    fontSize: '0.75rem',
                    marginLeft: '0.25rem',
                  }}
                  title={`Teil einer Konversation mit ${email.conversationMessageCount} Nachrichten`}
                >
                  (🗨️ {email.conversationMessageCount})
                </span>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
            <span style={{ fontWeight: '600', color: '#6c757d', fontSize: '0.8rem' }}>Anhänge:</span>
            {loadingAttachments ? (
              <span style={{ color: '#6c757d', fontSize: '0.75rem' }}>Lade...</span>
            ) : attachments.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'center' }}>
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDownloadAttachment(attachment.id, attachment.filename);
                    }}
                    style={{
                      color: '#007bff',
                      textDecoration: 'none',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid transparent',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderBottomColor = '#007bff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderBottomColor = 'transparent';
                    }}
                    title={`${attachment.filename} (${formatFileSize(attachment.sizeBytes)})`}
                  >
                    <FiPaperclip size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                    {attachment.filename}
                  </a>
                ))}
              </div>
            ) : (
              <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>Keine</span>
            )}
          </div>
          {email.cc && email.cc.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <span style={{ fontWeight: '600', color: '#6c757d', fontSize: '0.8rem' }}>CC:</span>
              <span style={{ color: '#333' }}>
                {Array.isArray(email.cc) ? email.cc.join(', ') : email.cc}
              </span>
            </div>
          )}
          {email.bcc && email.bcc.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <span style={{ fontWeight: '600', color: '#6c757d', fontSize: '0.8rem' }}>BCC:</span>
              <span style={{ color: '#333' }}>[Ausgeblendet]</span>
            </div>
          )}
        </div>
      </div>

      {/* Anhänge */}
      {email.hasAttachment && (
        <div style={{ borderBottom: '1px solid #e9ecef', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6c757d', marginBottom: '0.5rem' }}>
            Anhänge
          </div>
          {loadingAttachments ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="spinner" style={{ margin: '0 auto', width: '16px', height: '16px' }}></div>
            </div>
          ) : attachments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#333', marginBottom: '0.25rem' }}>
                      {attachment.filename}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                      {formatFileSize(attachment.sizeBytes)} • {attachment.contentType}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.8rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginLeft: '0.5rem',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#0056b3';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#007bff';
                    }}
                  >
                    <FiDownload size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                    Download
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#6c757d', fontStyle: 'italic' }}>
              Keine Anhänge gefunden
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          flex: 1,
          padding: '0.75rem',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.6',
          overflowY: 'auto',
          color: '#333',
          fontSize: '0.875rem',
        }}
      >
        {loadingBody ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ margin: '0 auto', width: '20px', height: '20px' }}></div>
            <p style={{ marginTop: '0.5rem', color: '#6c757d', fontSize: '0.8rem' }}>Lade Inhalt...</p>
          </div>
        ) : (
          emailBody || email.body || '(Kein Inhalt)'
        )}
      </div>
    </div>
  );
}

