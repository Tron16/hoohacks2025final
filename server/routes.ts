import type { Express, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, callHistory, insertCallHistorySchema } from "@shared/schema";
import { z } from "zod";
import * as bcrypt from "bcrypt";
import twilio from "twilio";
import { OpenAI } from "openai";
import { Server as SocketServer } from "socket.io";
import { eq, and } from "drizzle-orm";
import { desc } from "drizzle-orm/sql/expressions/select";
import { db } from "./db";
import fs from "fs";
import path from "path";
import { WebSocketServer } from 'ws';

// Extend Express Request type to include session
import { Request } from "express";
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// Extend Twilio API types
declare module "twilio/lib/rest/api/v2010/account/call" {
  interface CallContextUpdateOptions {
    muted?: boolean;
  }
}

// Define login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

// Type for error handling
type ErrorWithMessage = {
  message: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Define call data type
// Define transcript message type
type TranscriptMessage = {
  text: string;
  isUser: boolean;
  timestamp: Date;
};

type CallData = {
  userId: number;
  phoneNumber: string;
  status: string;
  voiceModel: string;
  speechSpeed: number;
  startTime: Date;
  endTime?: Date;
  muted?: boolean;
  transcript?: TranscriptMessage[];
};

// In-memory store for active calls
const activeCalls = new Map<string, CallData>();

// Store active media streams for calls
const activeMediaStreams = new Map<string, any>();

// Audio format constants (16-bit signed PCM at 8kHz)
const SAMPLE_RATE = 8000;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Serve static audio files
  app.use('/audio', (req, res, next) => {
    const fileName = req.path.slice(1); // Remove leading slash
    const filePath = `/tmp/${fileName}`;
    
    try {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        return fs.createReadStream(filePath).pipe(res);
      } else {
        return res.status(404).send('Audio file not found');
      }
    } catch (error) {
      console.error("Error serving audio file:", error);
    }
  });
  

  
  // Set up Socket.IO for real-time communication
  const io = new SocketServer(httpServer);
  
  io.on("connection", (socket) => {
    console.log("New client connected");
    
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });
  
  // Create a static directory to serve audio files from /tmp
  try {
    if (!fs.existsSync('/tmp')) {
      fs.mkdirSync('/tmp', { recursive: true });
    }
    app.use('/temp-audio', (req, res, next) => {
      // Get the filename from the path
      const filename = req.path.split('/').pop() || '';
      const filepath = path.join('/tmp', filename);
      
      // Security check to prevent path traversal
      if (filename.includes('..') || !filename.match(/^[a-zA-Z0-9_\-\.]+$/)) {
        return res.status(400).send('Invalid filename');
      }
      
      // Check if file exists
      if (!fs.existsSync(filepath)) {
        return res.status(404).send('Audio file not found');
      }
      
      // Check for forceMime parameter (for browser compatibility testing)
      const forceMime = req.query.forceMime as string;
      
      // Set content type based on file extension or forced MIME type
      if (forceMime) {
        res.set('Content-Type', forceMime);
      } else if (filename.endsWith('.mp3')) {
        res.set('Content-Type', 'audio/mpeg');
      } else if (filename.endsWith('.wav')) {
        res.set('Content-Type', 'audio/wav');
      } else if (filename.endsWith('.ogg')) {
        res.set('Content-Type', 'audio/ogg');
      } else {
        res.set('Content-Type', 'application/octet-stream');
      }
      
      // Improve browser compatibility with headers
      // Enable partial content responses for better streaming
      res.set('Accept-Ranges', 'bytes');
      
      // Set CORS headers for better compatibility in different contexts
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, HEAD');
      res.set('Access-Control-Allow-Headers', 'Range');
      
      // Use a short cache time instead of no cache - helps with browsers
      // that may request the audio multiple times
      res.set('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
      
      // Send the file with proper error handling
      res.sendFile(filepath, (err) => {
        if (err) {
          console.error(`Error serving audio file ${filename}:`, err);
          if (!res.headersSent) {
            res.status(500).send('Error serving audio file');
          }
        }
      });
    });
  } catch (error) {
    console.error("Error setting up static audio directory:", error);
  }

  // Auth routes
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      // Validate the request body against our signup schema
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Create the user
      const user = await storage.createUser(validatedData);
      
      // Return the user without the password
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ 
        message: "User created successfully", 
        user: userWithoutPassword 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: "An error occurred during signup" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      // Validate the request body against our login schema
      const { email, password } = loginSchema.parse(req.body);
      
      // Find the user with the provided email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Compare the provided password with the stored hash
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Set user in session
      if (req.session) {
        req.session.userId = user.id;
      }
      
      // Return the user without the password
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json({ 
        message: "Login successful", 
        user: userWithoutPassword 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "An error occurred during login" });
    }
  });

  // User route
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get user from storage
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json({
        user: userWithoutPassword
      });
    } catch (error) {
      console.error("User route error:", error);
      res.status(500).json({ message: "An error occurred" });
    }
  });
  
  // Call history route
  app.get("/api/call-history", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get call history for user
      const userCalls = await db.select()
        .from(callHistory)
        .where(eq(callHistory.userId, req.session.userId))
        .orderBy(desc(callHistory.startTime));
      
      res.status(200).json({
        calls: userCalls
      });
    } catch (error) {
      console.error("Call history error:", error);
      res.status(500).json({ message: "Failed to retrieve call history" });
    }
  });
  
  // Delete call history item
  app.delete("/api/call-history/:id", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const callId = parseInt(req.params.id);
      if (isNaN(callId)) {
        return res.status(400).json({ message: "Invalid call ID" });
      }
      
      // Verify the call belongs to the authenticated user
      const [call] = await db
        .select()
        .from(callHistory)
        .where(and(
          eq(callHistory.id, callId),
          eq(callHistory.userId, req.session.userId)
        ));
      
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      // Delete the call record
      await db
        .delete(callHistory)
        .where(and(
          eq(callHistory.id, callId),
          eq(callHistory.userId, req.session.userId)
        ));
      
      res.status(200).json({ message: "Call deleted successfully" });
    } catch (error) {
      console.error("Error deleting call:", error);
      res.status(500).json({ message: "Failed to delete call" });
    }
  });

  // Twilio webhook for handling calls
  // Add a function to handle call ending and summary generation
  async function handleCallEnding(callSid: string) {
    if (!activeCalls.has(callSid)) return;
    
    const callData = activeCalls.get(callSid);
    if (!callData) return;
    
    // Update call status and end time
    const endTime = new Date();
    callData.status = "ended";
    callData.endTime = endTime;
    activeCalls.set(callSid, callData);
    
    // Calculate duration in seconds
    const duration = Math.floor((endTime.getTime() - callData.startTime.getTime()) / 1000);
    
    // Generate call summary if transcript exists and OpenAI is available
    let summary = null;
    if (openai && callData.transcript && callData.transcript.length > 0) {
      try {
        // Format the transcript for the summary
        const transcriptText = callData.transcript
          .map(msg => `${msg.isUser ? "User" : "Caller"}: ${msg.text}`)
          .join("\n");
        
        // Generate summary using OpenAI
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that summarizes phone call transcripts. Create a brief, concise summary of the key points from this call transcript. Format your response as a paragraph, focusing on the most important information exchanged."
            },
            {
              role: "user",
              content: transcriptText
            }
          ],
          max_tokens: 250
        });
        
        summary = response.choices[0].message.content;
        console.log("Generated call summary:", summary);
      } catch (summaryError) {
        console.error("Error generating call summary:", summaryError);
      }
    }
    
    // Update call in database
    try {
      await db.update(callHistory)
        .set({
          status: "ended",
          endTime: endTime,
          duration: duration,
          transcript: callData.transcript || null,
          summary: summary
        })
        .where(eq(callHistory.callSid, callSid));
    } catch (dbError) {
      console.error("Error updating call in database:", dbError);
    }
    
    // Emit call status update with summary if available
    io.emit("call-status", {
      callSid,
      status: "ended",
      summary
    });
  }

  // Twilio status callback endpoint
  app.post("/api/call/status", async (req, res) => {
    try {
      const callSid = req.body.CallSid;
      const callStatus = req.body.CallStatus;
      
      console.log(`Call status update for ${callSid}: ${callStatus}`);
      
      if (callSid && activeCalls.has(callSid)) {
        // Map Twilio call status to our application status
        let appStatus = "connected";
        
        // Handle different Twilio call statuses
        if (callStatus === "completed" || callStatus === "busy" || 
            callStatus === "failed" || callStatus === "no-answer" || 
            callStatus === "canceled") {
          appStatus = "ended";
          // Handle call ending
          await handleCallEnding(callSid);
        } else if (callStatus === "ringing") {
          appStatus = "ringing";
        } else if (callStatus === "in-progress") {
          appStatus = "connected";
        }
        
        // Emit call status to all connected clients
        io.emit("call-status", {
          callSid,
          status: appStatus
        });
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error("Call status webhook error:", error);
      res.sendStatus(500);
    }
  });

  app.post("/api/call/webhook", async (req, res) => {
    if (!twilioClient || !openai) {
      return res.status(500).send("Twilio or OpenAI is not configured");
    }
    
    console.log("Received webhook for call:", req.body.CallSid);
    
    // Create TwiML response
    const twiml = new twilio.twiml.VoiceResponse();
    
    try {
      // Update call status in memory to connected
      const callSid = req.body.CallSid;
      if (callSid && activeCalls.has(callSid)) {
        const callData = activeCalls.get(callSid);
        if (callData) {
          callData.status = "connected";
          activeCalls.set(callSid, callData);
          
          // Emit call status to all connected clients
          io.emit("call-status", {
            callSid,
            status: "connected",
          });
        }
      }
      
      // Generate initial greeting with OpenAI TTS directly in the webhook
      const initialMessage = "This call is from an AI generated voice from Unmute. The person you are speaking with is using a text-to-speech service. Please speak clearly.";
      const voiceModel = (activeCalls.get(callSid)?.voiceModel) || "alloy";
      const speechSpeed = (activeCalls.get(callSid)?.speechSpeed) || 1.0;
      
      // Generate speech with OpenAI
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voiceModel,
        input: initialMessage,
        speed: speechSpeed,
      });
      
      // Get the audio data as a Buffer
      const audioBuffer = Buffer.from(await mp3.arrayBuffer());
      
      // Create a unique filename based on timestamp
      const filename = `greeting_${Date.now()}.mp3`;
      
      // Create a temporary directory if it doesn't exist
      try {
        if (!fs.existsSync('/tmp')) {
          fs.mkdirSync('/tmp', { recursive: true });
        }
      } catch (error) {
        console.error("Error creating temp directory:", error);
      }
      
      // Create a temporary file path
      const tempFilePath = `/tmp/${filename}`;
      
      // Write the audio data to a file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Get the public URL for the file
      const baseUrl = `https://${req.headers.host}`;
      const audioUrl = `${baseUrl}/temp-audio/${filename}`;
      
      // Set up a temporary route to serve this file
      app.get(`/temp-audio/${filename}`, (audioReq, audioRes) => {
        // Check if client requested a specific MIME type
        const forceMime = audioReq.query.forceMime;
        
        if (forceMime) {
          // Use the client-requested MIME type if specified
          audioRes.set('Content-Type', String(forceMime));
          console.log(`Serving greeting audio with client-requested MIME type: ${forceMime}`);
        } else {
          // Default to MP3 format
          audioRes.set('Content-Type', 'audio/mpeg');
        }
        
        // Set cache control headers to prevent caching issues
        audioRes.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        audioRes.set('Pragma', 'no-cache');
        audioRes.set('Expires', '0');
        
        audioRes.sendFile(tempFilePath);
        
        // After sending, schedule removal of this temp route and file
        setTimeout(() => {
          // Remove the route
          const routeIndex = app._router.stack.findIndex(
            (layer: any) => layer.route && layer.route.path === `/temp-audio/${filename}`
          );
          if (routeIndex !== -1) {
            app._router.stack.splice(routeIndex, 1);
          }
          
          // Remove the file
          try {
            fs.unlinkSync(tempFilePath);
            console.log(`Removed temporary file: ${tempFilePath}`);
          } catch (e) {
            console.error(`Failed to remove temporary file: ${tempFilePath}`, e);
          }
        }, 60000); // Clean up after 1 minute
      });
      
      // Play the greeting audio
      twiml.play({ loop: 1 }, audioUrl);
      console.log(`Initial greeting URL: ${audioUrl}`);
      
      // Just keep the call active - we'll use media streams for transcription
      twiml.pause({ length: 1 });
      
      // Set long timeout to keep call active
      twiml.pause({ length: 3600 });  // 1 hour max call length
    } catch (error) {
      console.error("Error in call webhook:", error);
      
      // Fallback to simple TwiML if there's an error
      twiml.say("This is an Unmute assisted call. The person you are speaking with is using text-to-speech.");
      
      twiml.gather({
        input: ['speech'],
        speechTimeout: '2',  // 2 seconds of silence for real-time response
        speechModel: 'enhanced',
        profanityFilter: false,
        action: `https://${req.headers.host}/api/call/transcribe`,
        method: 'POST'
      });
      
      twiml.pause({ length: 3600 });
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
  });
  
  // OpenAI transcribe endpoint (receives audio from Twilio and transcribes with OpenAI)
  app.post("/api/call/transcribe", async (req, res) => {
    try {
      const callSid = req.body.CallSid;
      const speechResult = req.body.SpeechResult;
      
      if (speechResult && callSid && activeCalls.has(callSid)) {
        console.log("Received transcription:", speechResult);
        
        // Get the call data
        const callData = activeCalls.get(callSid);
        
        if (!callData) {
          throw new Error(`No call data found for SID: ${callSid}`);
        }
        
        // Initialize transcript array if it doesn't exist
        if (!callData.transcript) {
          callData.transcript = [];
        }
        
        // Do basic formatting only - no GPT-4o mini (removed to avoid delays)
        let formattedText = speechResult.trim();
        
        // Capitalize first letter
        formattedText = formattedText.charAt(0).toUpperCase() + formattedText.slice(1);
        
        // Add period at end if missing
        if (!formattedText.endsWith('.') && !formattedText.endsWith('?') && !formattedText.endsWith('!')) {
          formattedText += '.';
        }
        
        // Log the transcription
        console.log("Transcription:", formattedText);
        
        // Store the formatted transcription (only store once)
        callData.transcript.push({
          text: formattedText,
          isUser: false,
          timestamp: new Date()
        });
        activeCalls.set(callSid, callData);
        
        // Emit transcription to all connected clients (only emit once)
        io.emit("transcription", {
          callSid,
          text: formattedText,
        });
        
        // Transcript has already been stored with basic formatting
        // We don't need to store it again or emit again, as we already did that before the OpenAI call
        // The background formatter will only update the local formattedText variable
        
        // Generate the speech from OpenAI voice models
        try {
          // Select a voice model based on the call data or use a random one
          const voiceModel = callData.voiceModel || "alloy";
          const speechSpeed = callData.speechSpeed || 1.0;
          
          // Check if OpenAI client is available
          if (!openai) {
            console.error("OpenAI client not available - OPENAI_API_KEY may be missing");
            throw new Error("Speech synthesis is unavailable");
          }
          
          // Generate speech with OpenAI
          const mp3 = await openai.audio.speech.create({
            model: "tts-1", // Using TTS-1 model
            voice: voiceModel,
            input: formattedText,
            speed: speechSpeed,
          });
          
          // Get the audio data as a Buffer
          const audioBuffer = Buffer.from(await mp3.arrayBuffer());
          
          // Create a unique filename based on timestamp
          const speechFilename = `speech_${Date.now()}.mp3`;
          const tempFilePath = `/tmp/${speechFilename}`;
          
          // Write the audio data to disk
          fs.writeFileSync(tempFilePath, audioBuffer);
          
          // Get the public URL for the file
          const baseUrl = `https://${req.headers.host}`;
          const audioUrl = `${baseUrl}/temp-audio/${speechFilename}`;
          
          // Set up a temporary route to serve this file
          app.get(`/temp-audio/${speechFilename}`, (audioReq, audioRes) => {
            // Check if client requested a specific MIME type
            const forceMime = audioReq.query.forceMime;
            
            if (forceMime) {
              // Use the client-requested MIME type if specified
              audioRes.set('Content-Type', String(forceMime));
              console.log(`Serving audio with client-requested MIME type: ${forceMime}`);
            } else {
              // Default to MP3 format
              audioRes.set('Content-Type', 'audio/mpeg');
            }
            
            // Set cache control headers to prevent caching issues
            audioRes.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            audioRes.set('Pragma', 'no-cache');
            audioRes.set('Expires', '0');
            
            audioRes.sendFile(tempFilePath);
            
            // After sending, schedule removal of this temp route and file
            setTimeout(() => {
              // Remove the route
              const routeIndex = app._router.stack.findIndex(
                (layer: any) => layer.route && layer.route.path === `/temp-audio/${speechFilename}`
              );
              if (routeIndex !== -1) {
                app._router.stack.splice(routeIndex, 1);
              }
              
              // Remove the file
              try {
                fs.unlinkSync(tempFilePath);
                console.log(`Removed temporary file: ${tempFilePath}`);
              } catch (e) {
                console.error(`Failed to remove temporary file: ${tempFilePath}`, e);
              }
            }, 60000); // Clean up after 1 minute
          });
          
          // Emit the speech audio event to clients
          io.emit("speech-audio", {
            callSid,
            audioUrl,
            text: formattedText,
          });
          
          // Continue gathering speech without delay to ensure continuous operation
          const twiml = new twilio.twiml.VoiceResponse();
          
          // Don't play the audio back on the call - it should only play in the browser
          // Skip the twiml.play() step here
          
          // Continue gathering speech with fast response settings for real-time interaction
          twiml.gather({
            input: ['speech'],
            speechTimeout: '2',  // 2 seconds of silence for faster transcription updates
            speechModel: 'enhanced', // Use enhanced speech model for better quality
            profanityFilter: false, // Allow all speech to be captured
            action: `https://${req.headers.host}/api/call/transcribe`,
            method: 'POST'
          });
          
          // Add a long pause to keep the call active
          twiml.pause({ length: 3600 });
          
          res.type('text/xml');
          return res.send(twiml.toString());
        } catch (speechError) {
          console.error("Error generating speech:", speechError);
          
          // Fallback in case of speech generation error
          const twiml = new twilio.twiml.VoiceResponse();
          
          // Continue gathering speech without playing anything
          twiml.gather({
            input: ['speech'],
            speechTimeout: '2',  // 2 seconds of silence for faster response
            speechModel: 'enhanced',
            profanityFilter: false,
            action: `https://${req.headers.host}/api/call/transcribe`,
            method: 'POST'
          });
          
          twiml.pause({ length: 3600 });
          
          res.type('text/xml');
          return res.send(twiml.toString());
        }
      }
      
      // If no speech detected, just continue the call with very fast response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.gather({
        input: ['speech'],
        speechTimeout: '2',  // 2 seconds of silence for faster response
        speechModel: 'enhanced',
        profanityFilter: false,
        action: `https://${req.headers.host}/api/call/transcribe`,
        method: 'POST'
      });
      twiml.pause({ length: 3600 });
      res.type('text/xml');
      res.send(twiml.toString());
    } catch (error) {
      console.error("Transcription error:", error);
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.pause({ length: 3600 });
      res.type('text/xml');
      res.send(twiml.toString());
    }
  });
  
  // Endpoint to handle recordings from Twilio
  app.post("/api/call/recording", async (req, res) => {
    try {
      const callSid = req.body.CallSid;
      const recordingUrl = req.body.RecordingUrl;
      const recordingSid = req.body.RecordingSid;
      
      console.log(`Received recording for call ${callSid}: ${recordingUrl}`);
      
      if (recordingUrl && callSid && activeCalls.has(callSid)) {
        // Instead of sending the Twilio recording URL directly to clients (which causes auth issues),
        // we'll create a proxy endpoint to fetch and serve this audio
        
        // Create a unique ID for this recording
        const recordingId = `recording_${Date.now()}`;
        const proxyUrl = `https://${req.headers.host}/api/call/audio/${recordingId}`;
        
        // Emit the proxied URL to clients
        io.emit("call-audio", {
          callSid,
          audioUrl: proxyUrl
        });
        
        // Use OpenAI to transcribe the audio from the recording
        if (openai) {
          try {
            // Download audio from Twilio for OpenAI transcription
            // Use Twilio authentication when fetching the recording
            const response = await fetch(recordingUrl, {
              headers: {
                "Authorization": `Basic ${Buffer.from(
                  `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
                ).toString("base64")}`
              }
            });
            
            if (!response.ok) {
              throw new Error(`Failed to download audio: ${response.status}`);
            }
            
            // Create a temporary file to store the audio
            const tempFilePath = `/tmp/call_${Date.now()}.mp3`;
            const audioData = await response.arrayBuffer();
            fs.writeFileSync(tempFilePath, Buffer.from(audioData));
            
            // Use OpenAI to transcribe the audio
            const transcription = await openai.audio.transcriptions.create({
              file: fs.createReadStream(tempFilePath),
              model: "whisper-1",
            });
            
            // Clean up temp file
            try {
              fs.unlinkSync(tempFilePath);
            } catch (err) {
              console.error("Error cleaning up temp audio file:", err);
            }
            
            // Process the transcription result
            const transcriptionText = transcription.text.trim();
            console.log("Received OpenAI transcription:", transcriptionText);
            
            // If we have a valid transcription and call data exists
            if (transcriptionText && activeCalls.has(callSid)) {
              const callData = activeCalls.get(callSid);
              if (callData) {
                // Store this transcription for later saving
                if (!callData.transcript) {
                  callData.transcript = [];
                }
                callData.transcript.push({
                  text: transcriptionText,
                  isUser: false,
                  timestamp: new Date()
                });
                activeCalls.set(callSid, callData);
                
                // Emit transcription to all connected clients
                io.emit("transcription", {
                  callSid,
                  text: transcriptionText,
                });
              }
            }
          } catch (transcribeError) {
            console.error("OpenAI transcription error:", transcribeError);
          }
        }
        
        // Continue listening for more audio
        const twiml = new twilio.twiml.VoiceResponse();
        
        // Record the next segment of audio
        twiml.record({
          action: `https://${req.headers.host}/api/call/recording`,
          timeout: 5, // 5 seconds max recording time
          transcribe: false, // We're using OpenAI for transcription
          playBeep: false // Don't play a beep when recording starts
        });
        
        twiml.pause({ length: 3600 });
        res.type('text/xml');
        return res.send(twiml.toString());
      }
      
      // Fallback response
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.pause({ length: 3600 });
      res.type('text/xml');
      res.send(twiml.toString());
    } catch (error) {
      console.error("Recording handling error:", error);
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.pause({ length: 3600 });
      res.type('text/xml');
      res.send(twiml.toString());
    }
  });

  // Start a call
  app.post("/api/call/start", async (req: Request, res: Response) => {
    try {
      // Validate Twilio is configured
      if (!twilioClient) {
        return res.status(500).json({ 
          message: "Twilio is not configured. Please provide TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN." 
        });
      }
      
      // Validate OpenAI is configured
      if (!openai) {
        return res.status(500).json({ 
          message: "OpenAI is not configured. Please provide OPENAI_API_KEY." 
        });
      }
      
      // Validate request body
      const { phoneNumber, voiceModel, speechSpeed } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      
      // Check if user is authenticated
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get base URL for callbacks with auth parameters
      const baseUrl = `https://${req.headers.host}`;
      
      // Convert Twilio credentials to base64 for basic auth in callback URLs
      // This prevents Twilio from prompting for authentication on callbacks
      const twilioAuthString = process.env.TWILIO_ACCOUNT_SID + ":" + process.env.TWILIO_AUTH_TOKEN;
      const twilioAuthBase64 = Buffer.from(twilioAuthString).toString('base64');
      
      // Initialize call with media streams for continuous live audio
      // Use type assertion to bypass TypeScript limitations with the Twilio SDK
      const call = await twilioClient.calls.create({
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER || "",
        url: `${baseUrl}/api/call/webhook`,
        statusCallback: `${baseUrl}/api/call/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        // Enable Twilio Media Streams - this will stream audio in real-time to our WebSocket
        // These parameters are valid but not typed in the SDK
        track: "inbound_track",
        mediaStreamMethod: "WS",
        mediaStreamUrl: `wss://${req.headers.host}/api/media-stream`,
      } as any);
      
      // Store call information in memory
      const startTime = new Date();
      activeCalls.set(call.sid, {
        userId: req.session.userId,
        phoneNumber,
        status: "ringing",
        voiceModel: voiceModel || "alloy",
        speechSpeed: speechSpeed || 1.0,
        startTime,
      });
      
      // Store call in database for history
      try {
        await db.insert(callHistory).values({
          userId: req.session.userId,
          callSid: call.sid,
          phoneNumber,
          startTime,
          status: "ringing",
          voiceModel: voiceModel || "alloy",
          speechSpeed: String(speechSpeed || 1.0),
        });
      } catch (dbError) {
        console.error("Error saving call to database:", dbError);
        // Continue with the call even if DB save fails
      }
      
      // Emit call status to all connected clients
      io.emit("call-status", {
        callSid: call.sid,
        status: "ringing",
      });
      
      console.log("Call initiated with SID:", call.sid);
      // Initial greeting will be handled by the webhook endpoint
      
      res.status(200).json({
        message: "Call initiated",
        callSid: call.sid,
        status: "ringing",
      });
    } catch (error) {
      console.error("Call start error:", error);
      res.status(500).json({ 
        message: "Failed to initiate call", 
        error: getErrorMessage(error) 
      });
    }
  });

  // End a call
  app.post("/api/call/end", async (req: Request, res: Response) => {
    try {
      const { callSid } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "Call SID is required" });
      }
      
      if (!twilioClient) {
        return res.status(500).json({ message: "Twilio is not configured" });
      }
      
      // Check if call exists
      if (!activeCalls.has(callSid)) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      // End the call
      await twilioClient.calls(callSid).update({ status: "completed" });
      
      // Update call status in memory
      const callData = activeCalls.get(callSid);
      const endTime = new Date();
      
      if (callData) {
        callData.status = "ended";
        callData.endTime = endTime;
        activeCalls.set(callSid, callData);
        
        // Calculate duration in seconds
        const duration = Math.floor((endTime.getTime() - callData.startTime.getTime()) / 1000);
        
        // Generate call summary using OpenAI if transcript exists
        let summary = null;
        if (openai && callData.transcript && callData.transcript.length > 0) {
          try {
            // Format the transcript for the summary
            const transcriptText = callData.transcript
              .map(msg => `${msg.isUser ? "User" : "Caller"}: ${msg.text}`)
              .join("\n");
            
            // Generate summary using OpenAI
            const response = await openai.chat.completions.create({
              model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
              messages: [
                {
                  role: "system",
                  content: "You are a helpful assistant that summarizes phone call transcripts. Create a brief, concise summary of the key points from this call transcript. Format your response as a paragraph, focusing on the most important information exchanged."
                },
                {
                  role: "user",
                  content: transcriptText
                }
              ],
              max_tokens: 250
            });
            
            summary = response.choices[0].message.content;
            console.log("Generated call summary:", summary);
          } catch (summaryError) {
            console.error("Error generating call summary:", summaryError);
            // Continue even if summary generation fails
          }
        }
        
        // Update call in database
        try {
          await db.update(callHistory)
            .set({
              status: "ended",
              endTime: endTime,
              duration: duration,
              transcript: callData.transcript || null,
              summary: summary
            })
            .where(eq(callHistory.callSid, callSid));
        } catch (dbError) {
          console.error("Error updating call in database:", dbError);
          // Continue even if DB update fails
        }
      }
      
      // Emit call status to all connected clients
      io.emit("call-status", {
        callSid,
        status: "ended",
      });
      
      res.status(200).json({
        message: "Call ended",
        callSid,
        status: "ended",
      });
    } catch (error) {
      console.error("Call end error:", error);
      res.status(500).json({ 
        message: "Failed to end call", 
        error: getErrorMessage(error) 
      });
    }
  });

  // Mute/unmute a call
  app.post("/api/call/mute", async (req: Request, res: Response) => {
    try {
      const { callSid, mute } = req.body;
      
      if (!callSid) {
        return res.status(400).json({ message: "Call SID is required" });
      }
      
      if (!twilioClient) {
        return res.status(500).json({ message: "Twilio is not configured" });
      }
      
      // Check if call exists
      if (!activeCalls.has(callSid)) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      // Update call mute status
      await twilioClient.calls(callSid).update({
        muted: mute,
      });
      
      // Update call data in memory
      const callData = activeCalls.get(callSid);
      if (callData) {
        callData.muted = mute;
        activeCalls.set(callSid, callData);
      }
      
      res.status(200).json({
        message: mute ? "Call muted" : "Call unmuted",
        callSid,
        muted: mute,
      });
    } catch (error) {
      console.error("Call mute error:", error);
      res.status(500).json({ 
        message: "Failed to mute/unmute call", 
        error: getErrorMessage(error) 
      });
    }
  });

  // Send DTMF tones
  app.post("/api/call/dtmf", async (req: Request, res: Response) => {
    try {
      const { callSid, digits } = req.body;
      
      if (!callSid || !digits) {
        return res.status(400).json({ message: "Call SID and digits are required" });
      }
      
      if (!twilioClient) {
        return res.status(500).json({ message: "Twilio is not configured" });
      }
      
      // Check if call exists
      if (!activeCalls.has(callSid)) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      // Send DTMF tones
      await twilioClient.calls(callSid).update({
        twiml: new twilio.twiml.VoiceResponse().play({ digits }).toString(),
      });
      
      res.status(200).json({
        message: "DTMF tones sent",
        callSid,
        digits,
      });
    } catch (error) {
      console.error("DTMF error:", error);
      res.status(500).json({ 
        message: "Failed to send DTMF tones", 
        error: getErrorMessage(error) 
      });
    }
  });

  // Text-to-speech for call using OpenAI TTS
  app.post("/api/call/speak", async (req: Request, res: Response) => {
    try {
      const { callSid, text, voiceModel, speechSpeed, playOnCallOnly = false } = req.body;
      
      if (!callSid || !text) {
        return res.status(400).json({ message: "Call SID and text are required" });
      }
      
      if (!twilioClient) {
        return res.status(500).json({ message: "Twilio is not configured" });
      }
      
      if (!openai) {
        return res.status(500).json({ message: "OpenAI is not configured" });
      }
      
      // Check if call exists
      if (!activeCalls.has(callSid)) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      // Verify call is still active
      try {
        const callInstance = await twilioClient.calls(callSid).fetch();
        
        if (callInstance.status !== 'in-progress') {
          return res.status(400).json({ 
            message: "Call is not in-progress", 
            status: callInstance.status 
          });
        }
      } catch (error) {
        console.error("Error checking call status:", error);
        return res.status(500).json({ 
          message: "Failed to check call status", 
          error: getErrorMessage(error) 
        });
      }
      
      // Get call data
      const callData = activeCalls.get(callSid);
      const selectedVoice = voiceModel || (callData ? callData.voiceModel : "alloy") || "alloy";
      const selectedSpeed = speechSpeed || (callData ? callData.speechSpeed : 1.0) || 1.0;
      
      // Use GPT-4o mini to format the text with proper punctuation and spelling
      let processedText = text;
      try {
        // Format the text with OpenAI's GPT-4o mini
        if (openai) {
          const formattingResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Use GPT-4o mini for better performance
            messages: [
              {
                role: "system",
                content: "You are an assistant that formats text with proper punctuation, capitalization, and corrects common spelling errors. Your only job is to fix formatting and spelling while preserving the meaning exactly. Return only the formatted text without any explanation."
              },
              {
                role: "user",
                content: text
              }
            ],
            temperature: 0.3, // Lower temperature for more consistent formatting
            max_tokens: 256
          });
          
          // Use the formatted text if available, otherwise use the original
          const formattedText = formattingResponse.choices[0].message.content?.trim();
          if (formattedText) {
            console.log("Original text:", text);
            console.log("Formatted text for TTS:", formattedText);
            processedText = formattedText;
          }
        }
      } catch (formatError) {
        console.error("Error formatting user message:", formatError);
        // Continue with the original text if formatting fails
      }
      
      // Store user's message in the transcript
      if (callData) {
        if (!callData.transcript) {
          callData.transcript = [];
        }
        callData.transcript.push({
          text: processedText,
          isUser: true,
          timestamp: new Date()
        });
        activeCalls.set(callSid, callData);
      }
      
      try {
        // Generate speech with OpenAI
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: selectedVoice,
          input: processedText,
          speed: selectedSpeed,
        });
        
        // Instead of sending base64 through TwiML (which causes the size issue),
        // we'll create a temporary audio URL for Twilio to access
        
        // Get the audio data as a Buffer
        const audioBuffer = Buffer.from(await mp3.arrayBuffer());
        
        // Create a unique filename based on timestamp
        const filename = `speech_${Date.now()}.mp3`;
        
        // Create a temporary directory if it doesn't exist
        try {
          if (!fs.existsSync('/tmp')) {
            fs.mkdirSync('/tmp', { recursive: true });
          }
        } catch (error) {
          console.error("Error creating temp directory:", error);
        }
        
        // Create a temporary file path (in-memory)
        const tempFilePath = `/tmp/${filename}`;
        
        // Write the audio data to a file
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        // Get the public URL for the file
        const baseUrl = `https://${req.headers.host}`;
        const audioUrl = `${baseUrl}/temp-audio/${filename}`;
        
        // Set up a temporary route to serve this file
        app.get(`/temp-audio/${filename}`, (audioReq, audioRes) => {
          audioRes.set('Content-Type', 'audio/mpeg');
          audioRes.sendFile(tempFilePath);
          
          // After sending, schedule removal of this temp route and file
          setTimeout(() => {
            // Remove the route
            const routeIndex = app._router.stack.findIndex(
              (layer: any) => layer.route && layer.route.path === `/temp-audio/${filename}`
            );
            if (routeIndex !== -1) {
              app._router.stack.splice(routeIndex, 1);
            }
            
            // Remove the file
            try {
              fs.unlinkSync(tempFilePath);
              console.log(`Removed temporary file: ${tempFilePath}`);
            } catch (e) {
              console.error(`Failed to remove temporary file: ${tempFilePath}`, e);
            }
          }, 60000); // Clean up after 1 minute
        });
        
        // Emit audio URL to clients so they can play it in the browser too
        io.emit("speech-audio", {
          callSid,
          audioUrl,
          text: processedText,
        });
        
        // Verify again the call is still active before playing audio
        const verifyCallInstance = await twilioClient.calls(callSid).fetch();
        
        if (verifyCallInstance.status !== 'in-progress') {
          return res.status(400).json({ 
            message: "Call is no longer in-progress", 
            status: verifyCallInstance.status 
          });
        }
        
        // Create TwiML to play the audio and continue the call
        const twiml = new twilio.twiml.VoiceResponse();
        
        // Play audio on the Twilio call only if playOnCallOnly is true
        // For messages from the website (playOnCallOnly=true), we play only on the call
        // For transcriptions from the call (playOnCallOnly=false), we play only in the browser
        if (playOnCallOnly) {
          // Play the audio on the Twilio call (message from website)
          twiml.play({ loop: 1 }, audioUrl);
          console.log(`Playing speech on call ${callSid} using URL: ${audioUrl} (playOnCallOnly=${playOnCallOnly})`);
        } else {
          // Skip playing audio on the Twilio call (call's own audio) to avoid echo
          console.log(`Skipping playing audio on Twilio call (playOnCallOnly=${playOnCallOnly})`);
        }
        
        // Add gather to keep the call active after playing the audio
        twiml.gather({
          input: ['speech'],
          speechTimeout: 'auto',
          action: `https://${req.headers.host}/api/call/transcribe`,
          method: 'POST'
        });
        
        // Add a long pause to ensure the call stays active
        twiml.pause({ length: 3600 });
        
        // Update the call with the TwiML
        await twilioClient.calls(callSid).update({
          twiml: twiml.toString()
        });
        
        console.log(`Updated call ${callSid} with new TwiML`);
        
        res.status(200).json({
          message: "Speech played on call",
          callSid,
        });
      } catch (error) {
        console.error("Error playing speech on call:", error);
        res.status(500).json({ 
          message: "Failed to play speech on call", 
          error: getErrorMessage(error) 
        });
      }
    } catch (error) {
      console.error("Text-to-speech error:", error);
      res.status(500).json({ 
        message: "Failed to play speech on call", 
        error: getErrorMessage(error) 
      });
    }
  });

  // Audio proxy endpoint - serves Twilio recordings through our backend with proper auth
  app.get("/api/call/audio/:recordingId", async (req: Request, res: Response) => {
    try {
      const recordingId = req.params.recordingId;
      
      // Improved detection of audio file types
      const isStreamAudio = recordingId.startsWith('stream_');
      const isRecording = recordingId.startsWith('recording_');
      const isPreview = recordingId.startsWith('preview_');
      
      if (!recordingId) {
        return res.status(400).json({ message: "Invalid audio ID format" });
      }
      
      // Check if client is forcing a specific MIME type
      const forceMime = req.query.forceMime as string;
      
      // Determine content type based on file extension or forced MIME type
      let contentType = 'audio/mpeg'; // Default to MP3
      
      if (forceMime) {
        // Allow client to force either WAV or MP3
        if (forceMime === 'audio/wav' || forceMime === 'audio/mpeg') {
          contentType = forceMime;
          console.log(`Client requested forced MIME type: ${contentType}`);
        }
      } else if (recordingId.endsWith('.wav')) {
        contentType = 'audio/wav';
      } else if (recordingId.endsWith('.ogg')) {
        contentType = 'audio/ogg';
      }
      
      // First check if the file exists in the /tmp directory
      const audioPath = `/tmp/${recordingId}`;
      
      // Log the request and path info
      console.log(`Audio request for: ${recordingId}, checking path: ${audioPath}, content type: ${contentType}`);
      
      // If file exists locally, serve directly with appropriate content type
      if (fs.existsSync(audioPath)) {
        console.log(`Found audio file locally at: ${audioPath}`);
        
        // Set appropriate headers
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Accept-Ranges', 'bytes'); // Support for range requests
        
        // Stream the file directly
        return fs.createReadStream(audioPath).pipe(res);
      } else {
        console.log(`Audio file not found locally: ${audioPath}`);
      }
      
      // For recordings from Twilio, we need to fetch and process them
      if (isRecording) {
        // Find the most recent active call
        const callEntries = Array.from(activeCalls.entries());
        const recentCalls = callEntries
          .filter(([_, data]) => data.status === 'connected' || data.status === 'in-progress')
          .sort((a, b) => new Date(b[1].startTime).getTime() - new Date(a[1].startTime).getTime());
        
        if (recentCalls.length === 0) {
          return res.status(404).json({ message: "No active calls found" });
        }
        
        // Use the most recent call's SID
        const callSid = recentCalls[0][0];
        
        try {
          // Check if Twilio client is available
          if (!twilioClient) {
            return res.status(500).json({ message: "Twilio client is not configured" });
          }
          
          // Get recordings for this call from Twilio
          const recordings = await twilioClient.recordings.list({ callSid });
          
          if (recordings.length === 0) {
            // Create a temporary beep sound instead of returning an error
            const tempAudioPath = `/tmp/${recordingId}.mp3`;
            
            // If we already cached this, use the cached version
            if (fs.existsSync(tempAudioPath)) {
              res.set('Content-Type', 'audio/mpeg');
              return fs.createReadStream(tempAudioPath).pipe(res);
            }
            
            // If we have OpenAI, generate a notification sound as fallback
            if (openai) {
              try {
                const mp3 = await openai.audio.speech.create({
                  model: "tts-1",
                  voice: "alloy",
                  input: "Listening...",
                  speed: 1.0,
                });
                
                const audioBuffer = Buffer.from(await mp3.arrayBuffer());
                fs.writeFileSync(tempAudioPath, audioBuffer);
                
                res.set('Content-Type', 'audio/mpeg');
                return res.send(audioBuffer);
              } catch (error) {
                console.error("Error generating fallback audio:", error);
                return res.status(404).json({ message: "No recordings found and failed to create fallback" });
              }
            } else {
              return res.status(404).json({ message: "No recordings found for this call" });
            }
          }
          
          // Sort recordings by dateCreated (newest first)
          recordings.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
          
          // Try MP3 format first, which is more widely supported in browsers
          let recordingUrl = recordings[0].uri.replace('.json', '.mp3');
          let contentType = 'audio/mpeg';
          
          try {
            const mp3Url = `https://api.twilio.com${recordingUrl}`;
            
            // Download the recording with proper auth
            const mp3Response = await fetch(mp3Url, {
              headers: {
                "Authorization": `Basic ${Buffer.from(
                  `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
                ).toString("base64")}`
              }
            });
            
            if (!mp3Response.ok) {
              // Try WAV format as fallback
              recordingUrl = recordings[0].uri.replace('.json', '.wav');
              contentType = 'audio/wav';
              
              const wavUrl = `https://api.twilio.com${recordingUrl}`;
              const wavResponse = await fetch(wavUrl, {
                headers: {
                  "Authorization": `Basic ${Buffer.from(
                    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
                  ).toString("base64")}`
                }
              });
              
              if (!wavResponse.ok) {
                throw new Error(`Failed to download recording in any format: ${wavResponse.status}`);
              }
              
              const audioBuffer = Buffer.from(await wavResponse.arrayBuffer());
              
              // Cache the file for faster future access
              const cachedPath = `/tmp/${recordingId}.wav`;
              fs.writeFileSync(cachedPath, audioBuffer);
              
              // Set appropriate headers and ensure browser knows it's WAV
              res.set('Content-Type', 'audio/wav');
              res.set('Content-Length', audioBuffer.length.toString());
              
              // Send the audio file
              return res.send(audioBuffer);
            }
            
            const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
            
            // Cache the file for faster future access
            const cachedPath = `/tmp/${recordingId}.mp3`;
            fs.writeFileSync(cachedPath, audioBuffer);
            
            // Set appropriate headers and ensure browser knows it's MP3
            res.set('Content-Type', 'audio/mpeg');
            res.set('Content-Length', audioBuffer.length.toString());
            
            // Send the audio file
            return res.send(audioBuffer);
          } catch (error) {
            console.error("Error fetching recording:", error);
            return res.status(500).json({ message: "Failed to fetch recording", error: getErrorMessage(error) });
          }
        } catch (error) {
          console.error("Error accessing Twilio API:", error);
          return res.status(500).json({ message: "Failed to access Twilio API", error: getErrorMessage(error) });
        }
      }
    } catch (error) {
      console.error("Error serving audio file:", error);
      return res.status(500).json({ message: "Server error", error: getErrorMessage(error) });
    }
  });

  // Helper function to check if a file is likely a valid audio file
  function isAudioFile(filename: string): boolean {
    // Check common audio file extensions
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    return audioExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }
  
  // Helper function to generate file paths for different audio types
  function getAudioFilename(type: 'preview' | 'stream' | 'recording', extension: string = 'mp3'): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000); // Add randomness to prevent collisions
    switch (type) {
      case 'preview':
        return `preview_${timestamp}_${random}.${extension}`;
      case 'stream':
        return `stream_${timestamp}_${random}.${extension}`;
      case 'recording':
        return `recording_${timestamp}_${random}.${extension}`;
      default:
        return `audio_${timestamp}_${random}.${extension}`;
    }
  }
  
  // WebSocket endpoint for Twilio Media Streams
  // This is where continuous real-time audio will flow from Twilio to our app
  
  // WebSocket server will be used for Twilio Media Streams
  
  // We already have audio constants defined at the top of the file (SAMPLE_RATE, BITS_PER_SAMPLE)
  
  // Using activeMediaStreams from the top of the file
  
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/api/media-stream'
  });
  
  // We already have CHANNELS defined at the top of the file

  // Handle WebSocket connections from Twilio Media Streams
  wss.on('connection', (ws: any, req: any) => {
    console.log('Media Stream WebSocket connection established');
    let callSid: string | null = null;
    let streamSid: string | null = null;
    let currentAudioChunks: Buffer[] = [];
    let lastSelectedVoice: string | null = null; // Store the selected voice model for consistency
    let accumulatedTranscription: string = ""; // Maintain a rolling window of transcription for context

    // Initialize a random voice at the start of the call
    const voiceModels = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const randomVoiceIndex = Math.floor(Math.random() * voiceModels.length);
    lastSelectedVoice = voiceModels[randomVoiceIndex];
    console.log(`Using voice model "${lastSelectedVoice}" for this call session`);
    let audioCounter = 0; // Used to create unique filenames
    let fullCallRecording: Buffer[] = []; // Store the entire call's audio data

    ws.on('message', async (message: any) => {
      try {
        // Twilio sends different message types, let's parse it first
        const msg = JSON.parse(message);
        
        // Handle stream start event - this gives us the call SID
        if (msg.event === 'start') {
          callSid = msg.start.callSid;
          streamSid = msg.start.streamSid;
          console.log(`Media stream started for call: ${callSid}, stream: ${streamSid}`);
          
          // Store the websocket connection for this call
          if (callSid) { // Check if callSid exists before using it as a key
            // Type assertion to string since we've confirmed it's not null
            activeMediaStreams.set(callSid as string, { ws, streamSid, chunks: [] });
            
            // Emit event to clients that audio streaming is available
            io.emit("call-streaming-available", {
              callSid,
              status: true
            });
          }
        } 
        // Handle media message which contains the audio data
        else if (msg.event === 'media') {
          if (!callSid) return;
          
          // Get the audio data
          const payload = msg.media.payload;
          const chunk = Buffer.from(payload, 'base64');
          
          // Add to the full call recording
          fullCallRecording.push(chunk);
          
          // Accumulate audio chunks for processing
          currentAudioChunks.push(chunk);
          
          // Process audio in smaller, more frequent chunks to ensure continuous transcription
          // Process at smaller chunk size for more responsive transcription
          if (currentAudioChunks.length >= 3) { // ~0.375 seconds at 8kHz
            audioCounter++;
            const streamData = activeMediaStreams.get(callSid);
            if (streamData) {
              streamData.chunks = [...streamData.chunks, ...currentAudioChunks];
              activeMediaStreams.set(callSid, streamData);
              
              // Create a copy of the accumulated chunks for processing
              const audioToProcess = Buffer.concat(currentAudioChunks);
              
              // Reset the current chunks for next batch
              currentAudioChunks = [];
              
              // Transcribe with OpenAI if available
              if (openai) {
                try {
                  // Create temporary audio file for OpenAI
                  const tempFilePath = `/tmp/stream_${Date.now()}.wav`;
                  
                  // We need to convert the raw PCM data to a valid WAV file
                  // Create a proper WAV header for 8kHz 16-bit mono PCM
                  const wavHeader = Buffer.alloc(44);
                  
                  // "RIFF" chunk descriptor
                  wavHeader.write('RIFF', 0);
                  wavHeader.writeUInt32LE(36 + audioToProcess.length, 4); // File size
                  wavHeader.write('WAVE', 8);
                  
                  // "fmt " sub-chunk
                  wavHeader.write('fmt ', 12);
                  wavHeader.writeUInt32LE(16, 16); // fmt chunk size
                  wavHeader.writeUInt16LE(1, 20); // Audio format (PCM)
                  wavHeader.writeUInt16LE(CHANNELS, 22); // Channels (mono)
                  wavHeader.writeUInt32LE(SAMPLE_RATE, 24); // Sample rate
                  wavHeader.writeUInt32LE(SAMPLE_RATE * BITS_PER_SAMPLE / 8 * CHANNELS, 28); // Byte rate
                  wavHeader.writeUInt16LE(BITS_PER_SAMPLE / 8 * CHANNELS, 32); // Block align
                  wavHeader.writeUInt16LE(BITS_PER_SAMPLE, 34); // Bits per sample
                  
                  // "data" sub-chunk
                  wavHeader.write('data', 36);
                  wavHeader.writeUInt32LE(audioToProcess.length, 40); // Data size
                  
                  // Combine header and audio data
                  const wavFile = Buffer.concat([wavHeader, audioToProcess]);
                  
                  // Write to file
                  fs.writeFileSync(tempFilePath, wavFile);
                  
                  // Use OpenAI to transcribe the audio
                  const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(tempFilePath),
                    model: "whisper-1",
                    language: "en", // Specify language to improve accuracy
                  });
                  
                  // Clean up temp file
                  fs.unlinkSync(tempFilePath);
                  
                  // Only emit if we have actual transcription text
                  if (transcription.text.trim()) {
                    console.log(`Real-time transcription for ${callSid}: ${transcription.text}`);
                    
                    // Add current transcription to the accumulated context
                    accumulatedTranscription += " " + transcription.text;
                    
                    // Keep only the last 500 characters to limit context size
                    if (accumulatedTranscription.length > 500) {
                      accumulatedTranscription = accumulatedTranscription.slice(-500);
                    }
                    
                    // Store in call data
                    const callData = activeCalls.get(callSid);
                    if (callData) {
                      if (!callData.transcript) {
                        callData.transcript = [];
                      }
                      
                      // Store raw transcription in call history
                      callData.transcript.push({
                        text: transcription.text,
                        isUser: false,
                        timestamp: new Date()
                      });
                      activeCalls.set(callSid, callData);
                      
                      // Enhance the transcription with GPT-4o Mini for better formatting
                      try {
                        if (openai) {
                          const chatCompletion = await openai.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages: [
                              {
                                role: "system", 
                                content: "You are a transcription formatter. Format the raw transcription into clear, readable text. Fix punctuation, capitalization, and add paragraph breaks where appropriate. Don't add any information not in the original text."
                              },
                              {
                                role: "user", 
                                content: `Format this raw transcription: "${transcription.text}"`
                              }
                            ],
                            temperature: 0.3,
                          });
                          
                          const formattedTranscription = chatCompletion.choices[0]?.message?.content || transcription.text;
                          console.log(`Formatted transcription: ${formattedTranscription}`);
                          
                          // Emit the formatted transcription to clients
                          io.emit("transcription", {
                            callSid,
                            text: formattedTranscription,
                          });
                          
                          // Now convert the formatted text to speech with the selected voice
                          if (lastSelectedVoice) {
                            try {
                              const mp3 = await openai.audio.speech.create({
                                model: "tts-1",
                                voice: lastSelectedVoice,
                                input: formattedTranscription,
                                speed: 0.9,
                              });
                              
                              const audioBuffer = Buffer.from(await mp3.arrayBuffer());
                              
                              // Create a unique filename for the speech audio
                              const speechFilename = `speech_${Date.now()}.mp3`;
                              const speechFilePath = `/tmp/${speechFilename}`;
                              
                              // Write the audio data to a file
                              fs.writeFileSync(speechFilePath, audioBuffer);
                              
                              // Create a temporary endpoint to serve this file
                              app.get(`/temp-audio/${speechFilename}`, (audioReq, audioRes) => {
                                audioRes.set('Content-Type', 'audio/mpeg');
                                audioRes.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                                audioRes.sendFile(speechFilePath);
                                
                                // Schedule cleanup after sending
                                setTimeout(() => {
                                  try {
                                    if (fs.existsSync(speechFilePath)) {
                                      fs.unlinkSync(speechFilePath);
                                      console.log(`Removed temp audio file: ${speechFilePath}`);
                                    }
                                  } catch (e) {
                                    console.error(`Failed to remove temp audio file: ${speechFilePath}`, e);
                                  }
                                }, 30000);
                              });
                              
                              // Generate the public URL for the audio
                              const baseUrl = `https://${req.headers.host}`;
                              const audioUrl = `${baseUrl}/temp-audio/${speechFilename}`;
                              
                              // Send the TTS audio to the client
                              io.emit("speech-audio", {
                                callSid,
                                audioUrl,
                                text: formattedTranscription
                              });
                              
                            } catch (error) {
                              console.error('Error generating speech:', error);
                              
                              // Still emit transcription if speech generation fails
                              io.emit("transcription", {
                                callSid,
                                text: formattedTranscription,
                              });
                            }
                          } else {
                            // If no voice selected, still emit transcription
                            io.emit("transcription", {
                              callSid,
                              text: formattedTranscription,
                            });
                          }
                        } else {
                          // Fallback to original transcription if OpenAI is not available
                          io.emit("transcription", {
                            callSid,
                            text: transcription.text,
                          });
                        }
                      } catch (error) {
                        console.error('Error formatting transcription:', error);
                        
                        // Fall back to sending the original transcription
                        io.emit("transcription", {
                          callSid,
                          text: transcription.text,
                        });
                      }
                    } else {
                      // If no call data, just send the raw transcription
                      io.emit("transcription", {
                        callSid,
                        text: transcription.text,
                      });
                    }
                  }
                } catch (error) {
                  console.error("OpenAI transcription error for stream:", error);
                }
              }
            }
          }
        }
        // Handle stream stop event
        else if (msg.event === 'stop') {
          console.log(`Media stream stopped for call: ${callSid}`);
          if (callSid) {
            // Save the full call recording before cleaning up
            if (fullCallRecording.length > 0) {
              try {
                // Save full call audio for future playback
                const fullAudioData = Buffer.concat(fullCallRecording);
                
                // Create WAV file for full recording
                const wavHeader = Buffer.alloc(44);
                
                // "RIFF" chunk descriptor
                wavHeader.write('RIFF', 0);
                wavHeader.writeUInt32LE(36 + fullAudioData.length, 4); // File size
                wavHeader.write('WAVE', 8);
                
                // "fmt " sub-chunk
                wavHeader.write('fmt ', 12);
                wavHeader.writeUInt32LE(16, 16); // fmt chunk size
                wavHeader.writeUInt16LE(1, 20); // Audio format (PCM)
                wavHeader.writeUInt16LE(CHANNELS, 22); // Channels (mono)
                wavHeader.writeUInt32LE(SAMPLE_RATE, 24); // Sample rate
                wavHeader.writeUInt32LE(SAMPLE_RATE * BITS_PER_SAMPLE / 8 * CHANNELS, 28); // Byte rate
                wavHeader.writeUInt16LE(BITS_PER_SAMPLE / 8 * CHANNELS, 32); // Block align
                wavHeader.writeUInt16LE(BITS_PER_SAMPLE, 34); // Bits per sample
                
                // "data" sub-chunk
                wavHeader.write('data', 36);
                wavHeader.writeUInt32LE(fullAudioData.length, 40); // Data size
                
                // Combine header and audio data
                const fullCallWav = Buffer.concat([wavHeader, fullAudioData]);
                
                // Save recording file
                const recordingFilename = `full_call_${callSid}_${Date.now()}.wav`;
                const recordingFilePath = `/tmp/${recordingFilename}`;
                fs.writeFileSync(recordingFilePath, fullCallWav);
                
                // Create route to serve the recording
                app.get(`/api/call/recording/${recordingFilename}`, (recReq, recRes) => {
                  recRes.set('Content-Type', 'audio/wav');
                  recRes.sendFile(recordingFilePath);
                });
                
                // Generate URL for full recording
                const recordingUrl = `https://${req.headers.host}/api/call/recording/${recordingFilename}`;
                
                // Store in database
                const callData = activeCalls.get(callSid);
                if (callData) {
                  try {
                    await db.update(callHistory)
                      .set({
                        recordingUrl: recordingUrl,
                        recordingData: fullCallWav.toString('base64') // Store as base64 for future use
                      })
                      .where(eq(callHistory.callSid, callSid));
                      
                    console.log(`Saved full call recording for call ${callSid}`);
                  } catch (dbError) {
                    console.error("Error saving call recording:", dbError);
                  }
                }
              } catch (recordingError) {
                console.error("Error saving call recording:", recordingError);
              }
            }
            
            // Clean up
            activeMediaStreams.delete(callSid);
            
            // Emit event to clients that audio streaming is no longer available
            io.emit("call-streaming-available", {
              callSid,
              status: false
            });
          }
        }
      } catch (err) {
        console.error('Error handling media stream message:', err);
      }
    });

    ws.on('close', () => {
      console.log('Media Stream WebSocket connection closed');
      if (callSid) {
        activeMediaStreams.delete(callSid);
      }
    });
  });

  // Voice preview endpoint for testing voice models
  app.post("/api/voice/preview", async (req: Request, res: Response) => {
    try {
      const { text, voiceModel, speechSpeed, preferredFormat } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      if (!openai) {
        return res.status(500).json({ message: "OpenAI is not configured" });
      }
      
      // Default preview text if none provided
      const previewText = text || "This is a preview of how your voice will sound during the call.";
      
      try {
        // Generate speech with OpenAI
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: voiceModel || "alloy",
          input: previewText,
          speed: speechSpeed || 0.9,
        });
        
        // Get the audio data as a Buffer
        const audioBuffer = Buffer.from(await mp3.arrayBuffer());
        
        // Determine file extension and MIME type based on preferred format
        let fileExtension = 'mp3';  // Default
        let forceMimeParam = '';
        
        // If client requested a specific format, respect it
        if (preferredFormat === 'wav') {
          fileExtension = 'wav';
          forceMimeParam = '?forceMime=audio/wav';
        } else if (preferredFormat === 'mp3') {
          fileExtension = 'mp3';
          forceMimeParam = '?forceMime=audio/mpeg';
        }
        
        // Create a unique filename based on timestamp with the appropriate extension
        const filename = getAudioFilename('preview', fileExtension);
        
        // Create a temporary directory if it doesn't exist
        try {
          if (!fs.existsSync('/tmp')) {
            fs.mkdirSync('/tmp', { recursive: true });
          }
        } catch (error) {
          console.error("Error creating temp directory:", error);
        }
        
        // Create a temporary file path
        const tempFilePath = `/tmp/${filename}`;
        
        // Write the audio data to a file
        fs.writeFileSync(tempFilePath, audioBuffer);
        
        // Get the public URL for the file, with optional forced MIME type
        const baseUrl = `https://${req.headers.host}`;
        const audioUrl = `${baseUrl}/api/call/audio/${filename}${forceMimeParam}`;
        
        console.log("Generated preview audio URL:", audioUrl, "Format:", fileExtension);
        
        res.json({ 
          success: true, 
          audioUrl 
        });
      } catch (error) {
        console.error("Error generating speech:", error);
        res.status(500).json({ 
          message: "Failed to generate speech", 
          error: getErrorMessage(error) 
        });
      }
    } catch (error) {
      console.error("Error in voice preview endpoint:", error);
      res.status(500).json({ 
        message: "Failed to process voice preview request", 
        error: getErrorMessage(error) 
      });
    }
  });

  return httpServer;
}
