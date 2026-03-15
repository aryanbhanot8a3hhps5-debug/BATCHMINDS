import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
export default app;

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // Supabase Setup
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Gemini Setup
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "BatchMind AI Backend Active" });
  });

  // RAG Endpoint: Generate Embeddings & Query
  app.post("/api/ai/query", async (req, res) => {
    const { query, batchId, chatHistory } = req.body;

    if (!query || !batchId) {
      return res.status(400).json({ error: "Query and batchId are required" });
    }

    try {
      console.log(`[AI Query] Batch: ${batchId}, Query: ${query}`);

      // 1. Generate embedding for the query
      const embeddingResponse = await genAI.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [query]
      });
      
      if (!embeddingResponse.embeddings || embeddingResponse.embeddings.length === 0) {
        throw new Error("Failed to generate embedding for query");
      }
      
      const embedding = embeddingResponse.embeddings[0].values;

      // 2. Match notes using pgvector via Supabase RPC
      // Note: match_notes should be updated to order by (similarity * 0.7 + (upvotes - downvotes) * 0.3)
      const { data: matchedNotes, error: matchError } = await supabase.rpc("match_notes", {
        query_embedding: embedding,
        match_threshold: 0.2, 
        match_count: 10,
        p_batch_id: batchId
      });

      if (matchError) {
        console.error("Supabase RPC Error:", matchError);
        throw new Error(`Database error: ${matchError.message}`);
      }

      // 3. Construct context from matched notes
      const context = matchedNotes && matchedNotes.length > 0
        ? matchedNotes.map((n: any) => `[Note: ${n.title}] [Subject: ${n.subject || 'General'}] [Date: ${n.created_at}]\n${n.content}`).join("\n\n---\n\n")
        : "No relevant notes found.";

      // 4. Determine response type based on query
      let responseType = 'text';
      let responseSchema: any = null;

      if (query.toLowerCase().includes('flashcard')) {
        responseType = 'flashcards';
        responseSchema = {
          type: "array",
          items: {
            type: "object",
            properties: {
              front: { type: "string" },
              back: { type: "string" }
            },
            required: ["front", "back"]
          }
        };
      } else if (query.toLowerCase().includes('quiz')) {
        responseType = 'quiz';
        responseSchema = {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answer: { type: "string" },
              explanation: { type: "string" }
            },
            required: ["question", "options", "answer"]
          }
        };
      }

      const systemPrompt = `
        You are BatchMind AI, a specialized academic assistant.
        Your goal is to answer questions, generate flashcards, or create quizzes based ONLY on the provided context.
        
        CONTEXT FROM BATCH NOTES:
        ${context}
        
        STRICT RULES:
        1. If the user asks for a specific date or subject, prioritize notes matching those criteria from the context.
        2. If generating flashcards, return a JSON array of {front, back}.
        3. If generating a quiz, return a JSON array of {question, options, answer, explanation}.
        4. If the answer is not in the context, state that notes are missing for this specific request.
        5. Use the provided context to summarize or explain when asked.
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...(chatHistory || []).map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })),
          { role: "user", parts: [{ text: query }] }
        ],
        config: { 
          systemInstruction: systemPrompt,
          responseMimeType: responseType !== 'text' ? "application/json" : "text/plain",
          responseSchema: responseSchema
        }
      });

      res.json({ 
        answer: result.text,
        type: responseType,
        sources: matchedNotes?.map((n: any) => ({ id: n.id, title: n.title })) || []
      });
    } catch (error: any) {
      console.error("AI Query Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // New Endpoint: Batch Summary
  app.post("/api/ai/batch-summary", async (req, res) => {
    const { batchId } = req.body;
    try {
      const { data: notes, error } = await supabase
        .from('notes')
        .select('title, content, subject, created_at')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const context = notes.map(n => `[${n.created_at}] [${n.subject}] ${n.title}: ${n.content}`).join('\n');
      
      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: "Summarize these notes by date and subject in an orderly manner." }] }],
        config: { 
          systemInstruction: `You are an academic organizer. Use the following notes to create a structured summary grouped by Subject and then Date.\n\nNOTES:\n${context}`
        }
      });

      res.json({ summary: result.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Note Processing: Generate Embedding on Create/Update
  app.post("/api/notes/create", async (req, res) => {
    const { batchId, title, content, subject, authorId, authorName } = req.body;

    try {
      // 1. Insert note
      const { data: note, error: insertError } = await supabase
        .from("notes")
        .insert([{
          batch_id: batchId,
          title,
          content,
          subject: subject || 'General',
          author_id: authorId,
          author_name: authorName
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Generate embedding (async)
      genAI.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [content]
      }).then(async (embeddingResponse) => {
        const embedding = embeddingResponse.embeddings[0].values;
        await supabase.from("notes").update({ embedding }).eq("id", note.id);
      });

      // 3. Create notifications for other users in the batch
      // For simplicity in hackathon, we'll notify all users except the author
      const { data: users } = await supabase.from('profiles').select('id').neq('id', authorId);
      if (users) {
        const notifications = users.map(u => ({
          user_id: u.id,
          message: `${authorName} uploaded a new note: ${title}`
        }));
        await supabase.from('notifications').insert(notifications);
      }

      res.json(note);
    } catch (error: any) {
      console.error("Create Note Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notes/vote", async (req, res) => {
    const { noteId, type, authorId } = req.body;

    try {
      // 1. Update note votes
      const { data: note, error: fetchError } = await supabase
        .from('notes')
        .select('upvotes, downvotes')
        .eq('id', noteId)
        .single();

      if (fetchError) throw fetchError;

      const updates = type === 'up' 
        ? { upvotes: note.upvotes + 1 } 
        : { downvotes: note.downvotes + 1 };

      await supabase.from('notes').update(updates).eq('id', noteId);

      // 2. Update author credibility score
      const { data: profile } = await supabase
        .from('profiles')
        .select('credibility_score')
        .eq('id', authorId)
        .single();

      if (profile) {
        const newScore = type === 'up' 
          ? profile.credibility_score + 10 
          : Math.max(0, profile.credibility_score - 5);
        
        await supabase.from('profiles').update({ credibility_score: newScore }).eq('id', authorId);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Note Processing: Generate Embedding on Create/Update (Legacy, keeping for compatibility if needed)
  app.post("/api/notes/embed", async (req, res) => {
    const { noteId, content } = req.body;

    try {
      const embeddingResponse = await genAI.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [content]
      });
      const embedding = embeddingResponse.embeddings[0].values;

      const { error } = await supabase
        .from("notes")
        .update({ embedding })
        .eq("id", noteId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Embedding Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" || process.env.VITE_DEV === "true") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`BatchMind AI Server running on http://localhost:${PORT}`);
    });
  }
}

// Only start the server if this file is run directly
const isMain = process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url));
if (isMain || !process.env.VERCEL) {
  startServer();
}
