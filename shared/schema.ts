import { pgTable, text, serial, boolean, timestamp, integer, varchar, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const callHistory = pgTable("call_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  callSid: varchar("call_sid", { length: 255 }).notNull().unique(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  voiceModel: varchar("voice_model", { length: 50 }),
  speechSpeed: varchar("speech_speed", { length: 10 }),
  status: varchar("status", { length: 20 }).notNull(),
  transcript: json("transcript"), // Store conversation transcript as JSON
  summary: text("summary"),       // Summarized call content
  recordingUrl: text("recording_url"), // URL to the call recording file
  recordingData: text("recording_data"), // Base64 encoded audio data for the full call
}, (table) => {
  return {
    userIdIdx: index("call_history_user_id_idx").on(table.userId),
  };
});

export const insertUserSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  email: true,
  password: true,
});

export const insertCallHistorySchema = createInsertSchema(callHistory).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCallHistory = z.infer<typeof insertCallHistorySchema>;
export type CallHistory = typeof callHistory.$inferSelect;
