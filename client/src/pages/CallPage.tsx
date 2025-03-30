import React, { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Hash, 
  Send,
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { fadeIn } from '@/lib/animations';
import io from 'socket.io-client';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

type CallStatus = "idle" | "connecting" | "ringing" | "connected" | "ended";

export default function CallPage() {
  // State for the call
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceModel, setVoiceModel] = useState('nova');
  const [speechSpeed, setSpeechSpeed] = useState([1.0]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [callSummary, setCallSummary] = useState<string | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  // State to track if live audio streaming is available
  const [isStreamingAvailable, setIsStreamingAvailable] = useState(false);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [isLiveAudioPlaying, setIsLiveAudioPlaying] = useState(false);
  
  // References
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isPlayingFromQueue = useRef<boolean>(false);
  
  // Hooks
  const { toast } = useToast();
  
  // Function to play next audio in queue with improved error handling
  const playNextInQueue = () => {
    if (audioQueue.current.length === 0) {
      isPlayingFromQueue.current = false;
      setIsPlayingAudio(false);
      setIsReceivingAudio(false);
      return;
    }
    
    isPlayingFromQueue.current = true;
    setIsPlayingAudio(true);
    setIsReceivingAudio(true);
    
    const nextUrl = audioQueue.current.shift();
    if (!nextUrl) {
      console.error("No URL found in queue");
      playNextInQueue(); // Try next item if this one is invalid
      return;
    }
    
    console.log(`Playing next audio from queue: ${nextUrl}`);
    
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    
    // Log playback events for debugging
    audio.addEventListener('loadstart', () => console.log('Audio loading started'));
    audio.addEventListener('canplaythrough', () => console.log('Audio can play through'));
    audio.addEventListener('playing', () => console.log('Audio started playing'));
    
    // On successful playback completion, play next in queue
    audio.onended = () => {
      console.log('Audio playback ended normally');
      playNextInQueue(); // Continue with next audio in queue
    };
    
    // Add a cache-busting parameter for better compatibility
    let enhancedUrl = nextUrl;
    const cacheBuster = Date.now();
    
    // Add cache buster to prevent browser caching issues
    if (enhancedUrl.includes('?')) {
      enhancedUrl = `${enhancedUrl}&cb=${cacheBuster}`;
    } else {
      enhancedUrl = `${enhancedUrl}?cb=${cacheBuster}`;
    }
    
    // Always force MP3 mime type first as it's most widely compatible
    // This helps prevent format errors on most browsers
    if (!enhancedUrl.includes('forceMime=')) {
      enhancedUrl = `${enhancedUrl}&forceMime=audio/mpeg`;
    }
    
    // Set the enhanced URL
    audio.src = enhancedUrl;
    
    // Try multiple formats if needed
    const tryMultipleFormats = async () => {
      console.log("Error playing speech audio, trying alternative formats");
      
      // List of formats to try in order of preference
      const formats = [
        { mime: 'audio/mpeg', ext: 'mp3' },
        { mime: 'audio/wav', ext: 'wav' },
        { mime: 'audio/aac', ext: 'aac' },
        { mime: 'audio/ogg', ext: 'ogg' }
      ];
      
      // Find which format we're currently using
      let currentFormatIndex = formats.findIndex(f => 
        enhancedUrl.includes(`forceMime=${f.mime}`)
      );
      
      if (currentFormatIndex === -1) {
        currentFormatIndex = 0; // Default to first format if not found
      }
      
      // Try each format in sequence
      for (let i = 0; i < formats.length; i++) {
        // Skip current format
        if (i === currentFormatIndex) continue;
        
        const format = formats[i];
        console.log(`Trying ${format.ext.toUpperCase()} format`);
        
        // Create URL with new format
        let newUrl = enhancedUrl;
        if (enhancedUrl.includes('forceMime=')) {
          // Replace existing mime type
          newUrl = enhancedUrl.replace(/forceMime=[^&]+/, `forceMime=${format.mime}`);
        } else {
          // Add new mime type
          newUrl = `${enhancedUrl}&forceMime=${format.mime}`;
        }
        
        try {
          // Try playing with new format
          const altAudio = new Audio();
          altAudio.preload = "auto";
          altAudio.crossOrigin = "anonymous";
          altAudio.src = newUrl;
          
          // Create a promise to track success or failure
          const playPromise = new Promise((resolve, reject) => {
            altAudio.oncanplaythrough = () => {
              console.log(`${format.ext.toUpperCase()} format loaded successfully`);
              resolve(true);
            };
            
            altAudio.onerror = (e) => {
              console.error(`${format.ext.toUpperCase()} format failed:`, e);
              reject(e);
            };
            
            // Set a timeout in case the event never fires
            setTimeout(() => reject(new Error("Format load timeout")), 3000);
          });
          
          // Wait for the format to load or fail
          await playPromise;
          
          // If we get here, format loaded successfully
          altAudio.onended = () => {
            console.log(`${format.ext.toUpperCase()} playback ended normally`);
            playNextInQueue();
          };
          
          // Play the audio
          await altAudio.play();
          console.log(`${format.ext.toUpperCase()} playing successfully`);
          
          // Success! Exit the retry loop
          return;
        } catch (err) {
          console.error(`Failed to play ${format.ext.toUpperCase()} format:`, err);
          // Continue to next format
        }
      }
      
      // If we get here, all formats failed
      console.error("All format attempts failed, moving to next audio");
      playNextInQueue();
    };
    
    // Handle playback errors with intelligent format fallback
    audio.onerror = async () => {
      // Get detailed error information
      const mediaError = audio.error;
      if (mediaError) {
        console.error(`Media error code: ${mediaError.code}, message: ${mediaError.message}`);
        
        // Check if it's a format error
        if (mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || 
            mediaError.code === MediaError.MEDIA_ERR_DECODE) {
          await tryMultipleFormats();
        } else {
          // For other errors, just skip to next
          console.error("Media error not related to format, skipping");
          playNextInQueue();
        }
      } else {
        // No error details available, try format switching anyway
        await tryMultipleFormats();
      }
    };
    
    // Start playing the audio with our enhanced URL
    audio.load();
    audio.play().catch(async err => {
      console.error("Error starting playback:", err);
      
      // Determine if this is a user interaction error
      if (err.name === 'NotAllowedError') {
        console.error("Browser requires user interaction before playing audio");
        toast({
          title: "Audio permission needed",
          description: "Please interact with the page to enable audio playback",
        });
        playNextInQueue(); // Skip this audio
      } else {
        // For format errors, try alternate formats
        await tryMultipleFormats();
      }
    });
  };
  
  // Set up socket connection
  useEffect(() => {
    console.log("Connecting to websocket server...");
    if (!socketRef.current) {
      socketRef.current = io();
      
      // Listen for call status updates
      socketRef.current.on("call-status", (data: { callSid: string, status: string, summary?: string }) => {
        console.log("Call status update:", data);
        
        if (data.callSid !== callSid) return;
        
        if (data.status === "connected") {
          setCallStatus("connected");
          toast({
            title: "Call Connected",
            description: "You can now start speaking",
          });
        } else if (data.status === "ended") {
          toast({
            title: "Call Ended",
            description: "The call has been disconnected",
          });
          
          // Reset states for new call
          setShowKeypad(false);
          setIsMuted(false);
          setCallStatus("ended");
          
          // Store the call summary if available
          if (data.summary) {
            setCallSummary(data.summary);
          }
          
          // Add a system message about the call ending, but only once
          // Clear any duplicate ending messages first
          setMessages(messages => messages.filter(msg => 
            msg.text !== "Call has ended. You can start a new call."
          ));
          addMessage("Call has ended. You can start a new call.", false);
        }
      });

      // Listen for transcriptions
      socketRef.current.on("transcription", (data: { callSid: string, text: string }) => {
        console.log("Received transcription:", data);
        
        if (data.callSid !== callSid) return;
        
        addMessage(data.text, false);
      });
      
      // Listen for speech audio to play on the website
      socketRef.current.on("speech-audio", (data: { callSid: string, audioUrl: string, text: string }) => {
        console.log("Received speech audio:", data);
        
        if (data.callSid !== callSid) return;
        
        // Add to queue instead of playing immediately
        // This ensures audio plays in order and doesn't overlap
        audioQueue.current.push(data.audioUrl);
        console.log(`Added to audio queue, length: ${audioQueue.current.length}`);
        
        // Start processing the queue if not already doing so
        if (!isPlayingFromQueue.current) {
          playNextInQueue();
        }
        
        // Do NOT add the message to the chat here as it's already added by the transcription event
        // This prevents duplicate messages
      });
      
      // Listen for streaming status updates
      socketRef.current.on("call-streaming-available", (data: { callSid: string, status: boolean }) => {
        console.log("Call streaming status update:", data);
        
        if (data.callSid !== callSid) return;
        
        setIsStreamingAvailable(data.status);
      });
      
      // Listen for incoming call audio (from the other party)
      socketRef.current.on("call-audio", (data: { callSid: string, audioUrl: string }) => {
        console.log("Received call audio URL:", data);
        
        if (data.callSid !== callSid) return;
        
        // Add to audio queue
        audioQueue.current.push(data.audioUrl);
        console.log(`Added to audio queue, length: ${audioQueue.current.length}`);
        
        // If not currently playing from queue, start playback
        if (!isPlayingFromQueue.current) {
          playNextInQueue();
        }
      });

      // Listen for errors
      socketRef.current.on("error", (error: Error) => {
        console.error("Socket error:", error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      });
      
      // Connection events
      socketRef.current.on("connect", () => {
        console.log("Connected to server websocket");
      });
      
      socketRef.current.on("disconnect", () => {
        console.log("Disconnected from server websocket");
      });
      
      socketRef.current.on("connect_error", (error: Error) => {
        console.error("Socket connection error:", error);
      });
    }

    return () => {
      // Clean up socket connection
      if (socketRef.current) {
        console.log("Disconnecting socket...");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [toast, callSid]);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Add a new message to the chat, with enhanced deduplication
  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
    };
    
    // Check for duplicates and near-duplicates using an improved algorithm
    setMessages((prev) => {
      // Empty state - just add the first message
      if (prev.length === 0) return [newMessage];
      
      // Get the last few messages to check against (up to 3 most recent)
      const recentMessages = prev.slice(-3);
      
      // Normalize the text for comparison (remove punctuation, lowercase, trim)
      const normalizeText = (input: string) => 
        input.toLowerCase().replace(/[^\w\s]/g, '').trim();
      
      const newTextNormalized = normalizeText(text);
      
      // Check against recent messages to catch duplicates even if they're not consecutive
      for (const message of recentMessages) {
        // Don't compare messages from different senders
        if (message.isUser !== isUser) continue;
        
        // 1. Exact match
        if (message.text === text) {
          console.log("Exact duplicate found:", text);
          return prev;
        }
        
        // 2. Very similar text (normalized matches)
        const messageTextNormalized = normalizeText(message.text);
        if (newTextNormalized === messageTextNormalized) {
          console.log("Normalized duplicate found:", text);
          return prev;
        }
        
        // 3. One is a subset of the other
        if (
          newTextNormalized.includes(messageTextNormalized) || 
          messageTextNormalized.includes(newTextNormalized)
        ) {
          // If they're received within 10 seconds of each other
          if (newMessage.timestamp.getTime() - new Date(message.timestamp).getTime() < 10000) {
            console.log("Subset duplicate found:", text);
            return prev;
          }
        }
        
        // 4. Direct similarity comparison based on length
        if (
          Math.abs(messageTextNormalized.length - newTextNormalized.length) < 5 &&
          messageTextNormalized.length > 0 &&
          newTextNormalized.length > 0
        ) {
          // Count matching characters (simpler implementation)
          let matchCount = 0;
          const minLength = Math.min(messageTextNormalized.length, newTextNormalized.length);
          
          for (let i = 0; i < minLength; i++) {
            if (messageTextNormalized[i] === newTextNormalized[i]) {
              matchCount++;
            }
          }
          
          const similarityRatio = matchCount / Math.max(messageTextNormalized.length, newTextNormalized.length);
          
          if (similarityRatio > 0.8) {
            console.log("High similarity duplicate found:", text);
            return prev;
          }
        }
      }
      
      // If we get here, it's a new unique message
      return [...prev, newMessage];
    });
  };

  // Start a call
  const startCall = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    try {
      setCallStatus("connecting");
      // Clear message history when starting a new call
      if (callStatus === "ended") {
        setMessages([]);
      }
      
      const response = await apiRequest("/api/call/start", {
        method: "POST",
        body: JSON.stringify({ 
          phoneNumber: phoneNumber.trim(),
          voiceModel,
          speechSpeed: speechSpeed[0],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.callSid) {
        setCallSid(response.callSid);
        setCallStatus("ringing");
        addMessage("Call connected. You can start typing messages now.", false);
      }
    } catch (error: any) {
      console.error("Error starting call:", error);
      setCallStatus("idle");
      toast({
        title: "Call Failed",
        description: error.message || "Could not connect the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  // End a call
  const endCall = async () => {
    if (!callSid) return;
    
    try {
      await apiRequest("/api/call/end", {
        method: "POST",
        body: JSON.stringify({ callSid }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      setCallStatus("ended");
      setCallSid(null);
    } catch (error: any) {
      console.error("Error ending call:", error);
      toast({
        title: "Error",
        description: error.message || "Could not end the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Toggle mute
  const toggleMute = async () => {
    if (!callSid) return;

    try {
      await apiRequest("/api/call/mute", {
        method: "POST",
        body: JSON.stringify({ 
          callSid,
          mute: !isMuted 
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      setIsMuted(!isMuted);
    } catch (error: any) {
      console.error("Error toggling mute:", error);
      toast({
        title: "Error",
        description: error.message || "Could not mute/unmute the call.",
        variant: "destructive",
      });
    }
  };

  // Send DTMF tones (keypad)
  const sendDtmf = async (digit: string) => {
    if (!callSid) return;

    try {
      await apiRequest("/api/call/dtmf", {
        method: "POST",
        body: JSON.stringify({ 
          callSid,
          digits: digit 
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      addMessage(`Sent digit: ${digit}`, true);
    } catch (error: any) {
      console.error("Error sending DTMF:", error);
      toast({
        title: "Error",
        description: error.message || "Could not send keypad tone.",
        variant: "destructive",
      });
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!currentMessage.trim() || !callSid || callStatus !== "connected") return;

    try {
      // Add message to UI first for immediate feedback
      addMessage(currentMessage, true);
      
      // Send to server
      await apiRequest("/api/call/speak", {
        method: "POST",
        body: JSON.stringify({
          callSid,
          text: currentMessage,
          voiceModel,
          speechSpeed: speechSpeed[0],
          playOnCallOnly: true, // Play on Twilio call only
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      // Clear input
      setCurrentMessage("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error.message || "Could not send your message.",
        variant: "destructive",
      });
    }
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Preview the selected voice
  const handlePlayVoicePreview = async () => {
    if (isPreviewingVoice) return;
    
    setIsPreviewingVoice(true);
    
    try {
      const response = await apiRequest("/api/voice/preview", {
        method: "POST",
        body: JSON.stringify({
          text: "This is a preview of how your voice will sound during the call.",
          voiceModel,
          speechSpeed: speechSpeed[0],
          preferredFormat: "mp3", // Specify MP3 format for better browser compatibility
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (response.success) {
        // Create an audio element for preview
        const audio = new Audio(response.audioUrl);
        audioPreviewRef.current = audio;
        
        audio.onended = () => {
          setIsPreviewingVoice(false);
          audioPreviewRef.current = null;
        };
        
        audio.onerror = (error) => {
          console.error("Error playing preview:", error);
          
          // Try alternate format if the first attempt fails
          const mediaError = audio.error;
          if (mediaError) {
            console.error(`Media error code: ${mediaError.code}, message: ${mediaError.message}`);
            
            // Try with an alternate format if available
            try {
              // If MP3 fails, try WAV format
              if (response.audioUrl.includes('forceMime=audio/mpeg')) {
                const wavUrl = response.audioUrl.replace('forceMime=audio/mpeg', 'forceMime=audio/wav');
                console.log("Trying alternate WAV format:", wavUrl);
                
                const alternateAudio = new Audio(wavUrl);
                audioPreviewRef.current = alternateAudio;
                
                alternateAudio.onended = () => {
                  setIsPreviewingVoice(false);
                  audioPreviewRef.current = null;
                };
                
                alternateAudio.onerror = () => {
                  console.error("Alternate format also failed");
                  setIsPreviewingVoice(false);
                  audioPreviewRef.current = null;
                  toast({
                    title: "Error",
                    description: "Could not play the voice preview.",
                    variant: "destructive",
                  });
                };
                
                alternateAudio.play().catch((err) => {
                  console.error("Error playing alternate format:", err);
                  setIsPreviewingVoice(false);
                  audioPreviewRef.current = null;
                  toast({
                    title: "Error",
                    description: "Could not play the voice preview with any format.",
                    variant: "destructive",
                  });
                });
                
                return; // Exit early as we're trying the alternate format
              }
            } catch (err) {
              console.error("Error attempting alternate format:", err);
            }
          }
          
          setIsPreviewingVoice(false);
          audioPreviewRef.current = null;
          toast({
            title: "Error",
            description: "Could not play the voice preview.",
            variant: "destructive",
          });
        };
        
        audio.play().catch((err) => {
          console.error("Error playing preview:", err);
          setIsPreviewingVoice(false);
          audioPreviewRef.current = null;
        });
      }
    } catch (error: any) {
      console.error("Error playing voice preview:", error);
      toast({
        title: "Error",
        description: error.message || "Could not generate voice preview.",
        variant: "destructive",
      });
      setIsPreviewingVoice(false);
    }
  };

  // Render keypad
  const renderKeypad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    
    return (
      <div className="grid grid-cols-3 gap-2 p-4">
        {keys.map((key) => (
          <Button
            key={key}
            variant="outline"
            onClick={() => sendDtmf(key)}
            className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-medium"
          >
            {key}
          </Button>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        {/* Voice Settings Panel - Now at the top */}
        <motion.div 
          initial="hidden"
          animate="show"
          variants={fadeIn}
          className="bg-gray-800 rounded-xl border border-gray-700 p-4 mx-auto w-full max-w-4xl"
        >
          <h3 className="text-lg font-semibold text-white mb-3">Voice Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Voice Model</label>
              <Select 
                value={voiceModel} 
                onValueChange={setVoiceModel}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-300">Speech Speed</label>
                <span className="text-sm text-gray-400">{speechSpeed[0]}x</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${((speechSpeed[0] - 0.5) / 1.5) * 100}%` }}
                />
              </div>
            </div>
            
            <div className="flex-grow">
              <Button
                variant="outline"
                onClick={handlePlayVoicePreview}
                disabled={isPreviewingVoice}
                className="w-full h-10 border-gray-600 bg-gray-700 text-white"
              >
                {isPreviewingVoice ? "Playing Preview..." : "Preview Voice"}
              </Button>
            </div>
          </div>
          
          {callSummary && callStatus === "ended" && (
            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
              <h4 className="text-sm font-medium text-purple-300 mb-2">Call Summary</h4>
              <p className="text-gray-300">{callSummary}</p>
            </div>
          )}
        </motion.div>
        
        <div className="flex flex-col md:flex-row gap-6 mx-auto w-full max-w-4xl">
          {/* Phone Call Interface - Main Content */}
          <motion.div 
            initial="hidden"
            animate="show"
            variants={fadeIn}
            className="bg-gray-900 rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col w-full md:w-1/3"
          >
            {/* Call Header with Status Bar */}
            <div className={`relative px-6 py-8 flex flex-col items-center ${
              callStatus === "idle" ? "bg-gray-800" :
              callStatus === "connecting" ? "bg-yellow-900" :
              callStatus === "ringing" ? "bg-blue-900" :
              callStatus === "connected" ? "bg-green-900" :
              "bg-red-900"
            }`}>
              {/* Status Indicators */}
              <div className="absolute top-3 right-4 flex space-x-2">
                {isStreamingAvailable && (
                  <div className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  </div>
                )}
                {isPlayingAudio && (
                  <div className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                  </div>
                )}
                {isReceivingAudio && (
                  <div className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  </div>
                )}
              </div>
              
              {/* Phone Number / Contact Info */}
              {(callStatus === "connecting" || callStatus === "ringing" || callStatus === "connected" || callStatus === "ended") && (
                <div className="flex flex-col items-center">
                  <h2 className="text-2xl font-bold text-white mb-1">{phoneNumber}</h2>
                  <div className={`text-center mb-3 px-4 py-1 rounded-full text-sm font-medium ${
                    callStatus === "connecting" ? "bg-yellow-600 bg-opacity-70" :
                    callStatus === "ringing" ? "bg-blue-600 bg-opacity-70" :
                    callStatus === "connected" ? "bg-green-600 bg-opacity-70" :
                    "bg-red-600 bg-opacity-70"
                  }`}>
                    {callStatus === "connecting" ? "Connecting..." :
                     callStatus === "ringing" ? "Ringing..." :
                     callStatus === "connected" ? "On Call" :
                     "Call Ended"}
                  </div>
                  
                  {/* Call Duration / Timer would go here */}
                  {callStatus === "connected" && (
                    <div className="text-gray-300 text-sm">
                      Voice: {voiceModel}
                    </div>
                  )}
                </div>
              )}
              
              {/* Call Entry UI */}
              {(callStatus === "idle") && (
                <div className="w-full max-w-xs">
                  <h2 className="text-xl font-bold text-white text-center mb-4">New Call</h2>
                  <Input
                    placeholder="Enter phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 text-center text-xl py-6 mb-2"
                  />
                </div>
              )}
            </div>
            
            {/* Call Controls */}
            <div className="mt-auto bg-gray-900 pt-3 pb-5 px-6">
              <div className="flex justify-center space-x-6">
                {/* Dialer / Start Call */}
                {callStatus === "idle" && (
                  <Button 
                    onClick={startCall}
                    className="bg-green-600 hover:bg-green-700 h-14 w-14 rounded-full flex items-center justify-center"
                  >
                    <Phone className="h-6 w-6" />
                  </Button>
                )}
                
                {/* Active Call Controls */}
                {(callStatus === "connecting" || callStatus === "ringing" || callStatus === "connected") && (
                  <>
                    {/* Mute Button */}
                    <Button 
                      onClick={toggleMute}
                      variant="outline"
                      className={`h-14 w-14 rounded-full flex items-center justify-center border-gray-600 ${
                        isMuted ? "bg-red-900 bg-opacity-50" : "bg-gray-800"
                      }`}
                    >
                      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>
                    
                    {/* End Call */}
                    <Button 
                      onClick={endCall}
                      className="bg-red-600 hover:bg-red-700 h-14 w-14 rounded-full flex items-center justify-center"
                    >
                      <PhoneOff className="h-6 w-6" />
                    </Button>
                    
                    {/* Keypad Toggle */}
                    <Button 
                      onClick={() => setShowKeypad(!showKeypad)}
                      variant="outline"
                      className={`h-14 w-14 rounded-full flex items-center justify-center border-gray-600 ${
                        showKeypad ? "bg-blue-900 bg-opacity-50" : "bg-gray-800"
                      }`}
                    >
                      <Hash className="h-6 w-6" />
                    </Button>
                  </>
                )}
                
                {/* Ended Call Action */}
                {callStatus === "ended" && (
                  <Button 
                    onClick={() => {
                      setCallStatus("idle");
                      setMessages([]);
                      setCallSummary(null);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg"
                  >
                    New Call
                  </Button>
                )}
              </div>
              
              {/* Keypad */}
              {showKeypad && (
                <div className="mt-4 grid grid-cols-3 gap-3 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                    <Button
                      key={key}
                      variant="outline"
                      onClick={() => sendDtmf(key)}
                      className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-medium border-gray-600 bg-gray-800"
                    >
                      {key}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
          
          {/* Messages Area - Larger and as a separate panel */}
          <motion.div 
            initial="hidden"
            animate="show"
            variants={fadeIn}
            className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden flex flex-col w-full md:w-2/3"
          >
            <div className="p-4 bg-gray-800 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Conversation</h3>
            </div>
            
            <div className="flex-1 p-4 overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto mb-4 space-y-4"
                style={{ height: 'calc(100vh - 380px)' }}
              >
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    {callStatus === "idle" 
                      ? "Start a call to begin chatting" 
                      : callStatus === "connecting" || callStatus === "ringing"
                      ? "Waiting for call to connect..." 
                      : callStatus === "connected"
                      ? "Waiting for the first message..." 
                      : "Call has ended"}
                  </div>
                ) : (
                  messages.map((message) => (
                    <div 
                      key={message.id}
                      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-md rounded-2xl px-4 py-3 ${
                          message.isUser 
                            ? 'bg-purple-600 text-white rounded-br-none' 
                            : 'bg-gray-700 text-white rounded-bl-none'
                        }`}
                      >
                        <p>{message.text}</p>
                        <p className={`text-xs mt-1 ${
                          message.isUser ? 'text-purple-200' : 'text-gray-300'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Message Input */}
              {callStatus === "connected" && (
                <div className="mt-auto border-t border-gray-700 pt-3">
                  <div className="flex space-x-2">
                    <Textarea
                      placeholder="Type message to speak on call..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 min-h-[60px] resize-none"
                    />
                    <Button
                      onClick={sendMessage}
                      className="bg-purple-600 hover:bg-purple-700 self-end h-10"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}