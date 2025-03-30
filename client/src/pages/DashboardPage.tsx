import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Hash,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
} from "lucide-react";
import { fadeIn, cardAnimation } from "@/lib/animations";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import io, { Socket } from "socket.io-client";

// Define types for message
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// Define types for call state
type CallStatus = "idle" | "connecting" | "ringing" | "connected" | "ended";

export default function DashboardPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Call State
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Voice settings
  const [voiceModel, setVoiceModel] = useState("alloy");
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  // Fixed speech speed at 0.9x as per requirements
  const speechSpeed = 0.9;

  // Connect to socket
  useEffect(() => {
    // Initialize socket connection when component mounts
    if (!socketRef.current) {
      console.log("Connecting to websocket server...");
      socketRef.current = io();

      // Listen for transcription events
      socketRef.current.on("transcription", (data) => {
        console.log("Received transcription:", data);
        addMessage(data.text, false);
      });

      // Listen for call status updates
      socketRef.current.on("call-status", (data) => {
        console.log("Call status update:", data);
        setCallStatus(data.status);
        if (data.callSid) {
          setCallSid(data.callSid);
        }

        if (data.status === "connected") {
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

          // Add a system message about the call ending, but only once
          // Clear any duplicate ending messages first
          setMessages(messages => messages.filter(msg => 
            msg.text !== "Call has ended. You can start a new call."
          ));
          addMessage("Call has ended. You can start a new call.", false);
        }
      });

      // Listen for errors
      socketRef.current.on("error", (error) => {
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

      socketRef.current.on("connect_error", (error) => {
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
  }, [toast]);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Add a new message to the chat
  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
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
          speechSpeed,
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
        description:
          error.message || "Could not connect the call. Please try again.",
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
        description:
          error.message || "Could not end the call. Please try again.",
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
          mute: !isMuted,
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
          digits: digit,
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

  // Preview voice model
  const previewVoice = async () => {
    if (isPreviewingVoice) return;
    
    try {
      setIsPreviewingVoice(true);
      
      // Sample text to preview
      const previewText = "This is a preview of how your voice will sound during the call.";
      
      const response = await apiRequest("/api/voice/preview", {
        method: "POST",
        body: JSON.stringify({
          text: previewText,
          voiceModel,
          speechSpeed,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (response.audioUrl) {
        // Play the audio
        const audio = new Audio(response.audioUrl);
        audio.onended = () => {
          setIsPreviewingVoice(false);
        };
        audio.play();
      } else {
        throw new Error("No audio URL returned");
      }
    } catch (error: any) {
      console.error("Error previewing voice:", error);
      setIsPreviewingVoice(false);
      toast({
        title: "Voice Preview Failed",
        description: error.message || "Could not preview the voice. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!currentMessage.trim() || !callSid || callStatus !== "connected")
      return;

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
          speechSpeed,
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
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Render keypad
  const renderKeypad = () => {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-600 text-white">
      {/* Header */}
      <header className="bg-white bg-opacity-10 backdrop-blur-sm border-b border-white border-opacity-20 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">unmute Dashboard</h1>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              className="text-white hover:bg-white hover:bg-opacity-10"
              onClick={() => setLocation("/")}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6 px-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel (Call Controls) */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeIn}
            className={`bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6 ${
              isCollapsed ? "lg:w-1/12" : "lg:w-1/3"
            } transition-all duration-300`}
          >
            {!isCollapsed ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Call Controls</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden hidden md:flex"
                    onClick={() => setIsCollapsed(true)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg mb-2">Call Status</h3>
                  <div
                    className={`text-center py-2 px-4 rounded-lg ${
                      callStatus === "idle"
                        ? "bg-gray-500"
                        : callStatus === "connecting"
                          ? "bg-yellow-500"
                          : callStatus === "ringing"
                            ? "bg-blue-500"
                            : callStatus === "connected"
                              ? "bg-green-500"
                              : "bg-red-500"
                    } font-medium`}
                  >
                    {callStatus === "idle"
                      ? "Ready to Call"
                      : callStatus === "connecting"
                        ? "Connecting..."
                        : callStatus === "ringing"
                          ? "Ringing..."
                          : callStatus === "connected"
                            ? "Connected"
                            : "Call Ended"}
                  </div>
                </div>

                {(callStatus === "idle" || callStatus === "ended") && (
                  <div className="mb-6">
                    <h3 className="text-lg mb-2">Start New Call</h3>
                    <div className="flex flex-col space-y-4">
                      <Input
                        placeholder="Enter phone number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="bg-white bg-opacity-20 border-white border-opacity-20 text-white placeholder:text-white placeholder:text-opacity-60"
                      />
                      <Button
                        onClick={startCall}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-700 hover:to-purple-500"
                      >
                        <Phone className="h-5 w-5 mr-2" />
                        Start Call
                      </Button>
                    </div>
                  </div>
                )}

                {(callStatus === "connecting" ||
                  callStatus === "ringing" ||
                  callStatus === "connected") && (
                  <div className="space-y-4 mb-6">
                    <Button
                      onClick={endCall}
                      variant="destructive"
                      className="w-full"
                    >
                      <PhoneOff className="h-5 w-5 mr-2" />
                      End Call
                    </Button>

                    <Button
                      onClick={toggleMute}
                      variant="outline"
                      className={`w-full border-white border-opacity-20 ${
                        isMuted
                          ? "bg-red-500 bg-opacity-30"
                          : "bg-white bg-opacity-20"
                      }`}
                    >
                      {isMuted ? (
                        <>
                          <MicOff className="h-5 w-5 mr-2" /> Unmute
                        </>
                      ) : (
                        <>
                          <Mic className="h-5 w-5 mr-2" /> Mute
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => setShowKeypad(!showKeypad)}
                      variant="outline"
                      className={`w-full border-white border-opacity-20 ${
                        showKeypad
                          ? "bg-blue-500 bg-opacity-30"
                          : "bg-white bg-opacity-20"
                      }`}
                    >
                      <Hash className="h-5 w-5 mr-2" />
                      Keypad
                    </Button>
                  </div>
                )}

                {showKeypad && renderKeypad()}

                <div className="space-y-4 mb-6">
                  <h3 className="text-lg mb-2">Voice Settings</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Voice Model</label>
                      <Button 
                        size="sm"
                        variant="ghost"
                        disabled={isPreviewingVoice}
                        onClick={previewVoice}
                        className="text-xs text-purple-300 hover:text-purple-100"
                      >
                        {isPreviewingVoice ? "Playing..." : "Preview Voice"}
                      </Button>
                    </div>
                    <Select value={voiceModel} onValueChange={setVoiceModel}>
                      <SelectTrigger className="bg-white bg-opacity-20 border-white border-opacity-20">
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
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">
                        Speech Speed
                      </label>
                      <span className="text-sm">{speechSpeed}x (Fixed)</span>
                    </div>
                    <div className="h-2 bg-purple-400 bg-opacity-30 rounded-full">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: "27%" }} // 0.9 is 27% of the way from 0.5 to 2.0
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(false)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}
          </motion.div>

          {/* Right Panel (Chat Interface) */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeIn}
            className={`bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-6 flex-1 flex flex-col`}
          >
            <h2 className="text-xl font-semibold mb-6">Chat Interface</h2>

            {/* Messages Container */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto mb-4 pr-2 space-y-4"
              style={{ maxHeight: "calc(100vh - 300px)" }}
            >
              {messages.length === 0 ? (
                <div className="text-center text-white text-opacity-60 py-8">
                  {callStatus === "idle"
                    ? "Start a call to begin chatting"
                    : "Waiting for the first message..."}
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs sm:max-w-sm md:max-w-md rounded-lg px-4 py-2 ${
                        message.isUser
                          ? "bg-purple-600 text-white"
                          : "bg-white bg-opacity-20 text-white"
                      }`}
                    >
                      <p>{message.text}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.isUser
                            ? "text-purple-200"
                            : "text-white text-opacity-60"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="mt-auto">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Type your message..."
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="bg-white bg-opacity-20 border-white border-opacity-20 text-white placeholder:text-white placeholder:text-opacity-60 min-h-[80px]"
                  disabled={callStatus !== "connected"}
                />
                <Button
                  onClick={sendMessage}
                  className="bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-700 hover:to-purple-500 self-end h-10"
                  disabled={callStatus !== "connected"}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              {callStatus !== "connected" && (
                <p className="text-sm text-white text-opacity-60 mt-2">
                  {callStatus === "idle"
                    ? "Start a call to send messages"
                    : callStatus === "connecting" || callStatus === "ringing"
                      ? "Waiting for call to connect..."
                      : "Call has ended"}
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
