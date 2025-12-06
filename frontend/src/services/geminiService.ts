import { GoogleGenAI, Type } from "@google/genai";
import { StudyData, QuizQuestion, StudyGuide } from "../types";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// Study Portal Types
export interface StudyPlan {
    topic: string;
    level: string;
    roadmap: { week: number; title: string; description: string; keyConcepts: string[] }[];
    resources: { title: string; type: string; url?: string; description: string }[];
}


const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genai = new GoogleGenAI({ apiKey });

// Simple concurrency limiter (semaphore)
const MAX_CONCURRENT = Number(import.meta.env.VITE_MAX_CONCURRENT || 4);
let _current = 0;
const _queue: Array<() => void> = [];
async function acquire() {
    if (_current < MAX_CONCURRENT) {
        _current++;
        return;
    }
    await new Promise<void>(resolve => _queue.push(resolve));
    _current++;
}
function release() {
    _current = Math.max(0, _current - 1);
    const next = _queue.shift();
    if (next) next();
}

// Exponential backoff with jitter; honors Retry-After header if present
async function retryWithBackoff<T>(fn: () => Promise<T>, options?: { retries?: number; minDelay?: number; maxDelay?: number; }) {
    const retries = options?.retries ?? 5;
    const minDelay = options?.minDelay ?? 500;
    const maxDelay = options?.maxDelay ?? 8000;
    let lastErr: any = null;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            const status = err?.status || err?.code || err?.response?.status;
            // If server returned Retry-After header, honor it
            let retryAfterMs: number | null = null;
            try {
                const raw = err?.response?.headers?.get?.('retry-after') || err?.response?.headers?.get?.('Retry-After');
                if (raw) {
                    const v = Number(raw);
                    if (!Number.isNaN(v)) retryAfterMs = v * 1000;
                }
            } catch (e) {
                // ignore header parsing errors
            }

            // Only retry on 429 or 5xx
            if (status !== 429 && !(status >= 500 && status < 600)) throw err;

            const backoff = Math.min(maxDelay, minDelay * Math.pow(2, attempt));
            const jitter = Math.random() * backoff * 0.5;
            const wait = retryAfterMs ?? Math.round(backoff / 2 + jitter);
            console.warn(`GenAI request failed (status=${status}). Retrying in ${wait}ms (attempt ${attempt + 1}/${retries})`);
            await new Promise(res => setTimeout(res, wait));
        }
    }
    throw lastErr;
}

async function callGenAI<T>(fn: () => Promise<T>) {
    await acquire();
    try {
        return await retryWithBackoff(fn);
    } finally {
        release();
    }
}

// Define schemas for structured output
const summarySchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING },
        keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        },
        factoids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        },
        detailedNotes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    topic: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    sourceExcerpt: { type: Type.STRING },
                    examples: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                },
                required: ["topic", "explanation", "examples"],
            },
        },
    },
    required: ["summary", "keyPoints", "factoids", "detailedNotes"],
};

const studyMaterialSchema = {
    type: Type.OBJECT,
    properties: {
        flashcards: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    front: { type: Type.STRING },
                    back: { type: Type.STRING },
                },
                required: ["front", "back"],
            },
        },
        quiz: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                    },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                },
                required: ["question", "options", "correctAnswer", "explanation"],
            },
        },
    },
    required: ["flashcards", "quiz"],
};

const studyGuideSchema = {
    type: Type.OBJECT,
    properties: {
        guide: { type: Type.STRING },
    },
    required: ["guide"],
};

const studyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        topic: { type: Type.STRING },
        level: { type: Type.STRING },
        roadmap: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    week: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    keyConcepts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["week", "title", "description", "keyConcepts"]
            }
        },
        resources: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING },
                    url: { type: Type.STRING },
                    description: { type: Type.STRING }
                },
                required: ["title", "type", "description"]
            }
        }
    },
    required: ["topic", "level", "roadmap", "resources"]
};


const fetchVideoMetadata = async (url: string) => {
    try {
        const response = await fetch(`https://noembed.com/embed?url=${url}`);
        const data = await response.json();
        return data.title ? `Title: ${data.title}\nAuthor: ${data.author_name}` : null;
    } catch (e) {
        console.error("Failed to fetch metadata", e);
        return null;
    }
};

// Helpers to handle PDF text extraction (for PDF uploads or URLs)
async function arrayBufferFromBase64(base64: string) {
    const bstr = atob(base64);
    const n = bstr.length;
    const u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
    return u8.buffer;
}

async function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer, options?: { maxChars?: number; concurrency?: number }) {
    const maxChars = options?.maxChars ?? 120000; // safety cap for model input
    const concurrency = options?.concurrency ?? 4;
    try {
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;
        let fullText = '';
        // process pages in small concurrent batches to speed up extraction without overwhelming memory
        for (let i = 1; i <= numPages; i += concurrency) {
            const batch = [] as Promise<{ idx: number; text: string }>[];
            for (let p = i; p < i + concurrency && p <= numPages; p++) {
                const pageIndex = p;
                const task = (async () => {
                    try {
                        const page = await pdfDoc.getPage(pageIndex);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((it: any) => it.str || '').join(' ');
                        return { idx: pageIndex, text: pageText };
                    } catch (e) {
                        return { idx: pageIndex, text: '' };
                    }
                })();
                batch.push(task);
            }

            const results = await Promise.all(batch);
            // sort by index to keep page order
            results.sort((a, b) => a.idx - b.idx);
            for (const r of results) {
                if (!r.text) continue;
                const chunk = `\n\n--- Page ${r.idx} ---\n${r.text}`;
                if (fullText.length + chunk.length > maxChars) {
                    // include as much as will fit and then stop
                    const remaining = maxChars - fullText.length;
                    if (remaining > 50) {
                        fullText += chunk.slice(0, remaining - 3) + '...';
                    }
                    // we reached cap
                    return { text: fullText.trim(), truncated: true, pages: numPages };
                }
                fullText += chunk;
            }
        }
        return { text: fullText.trim(), truncated: false, pages: numPages };
    } catch (e) {
        console.error('PDF text extraction failed', e);
        return { text: '', truncated: false, pages: 0 };
    }
}

export const runFullPipeline = async (
    input: string,
    mimeType: string
): Promise<StudyData> => {
    try {
        let context = "";
        if (mimeType === 'application/url') {
                // It's a URL
                const metadata = await fetchVideoMetadata(input);
                if (metadata) {
                    context = `\nVideo Metadata:\n${metadata}`;
                }
                context += "\nNOTE: This is a YouTube URL. If you cannot access the video content directly, use the provided metadata and your internal knowledge to generate the best possible summary. DO NOT HALLUCINATE information not present in the video.";
        }
        if (mimeType === 'application/pdf') {
            // Make it explicit that we've provided extracted PDF text in a following part
            context += "\nNOTE: The extracted text of the provided PDF is included as a separate part below. Use only that text when producing summaries or excerpts, and do not invent content not present in the text.";
        }

        // Stage 1: Analysis
        const analysisPrompt = `
      Analyze the provided document/video.
      Generate a structured summary with small, digestible paragraphs.
      Include a list of key points as bullet points.
      Include interesting factoids.
      ${context}
      
      CRITICAL INSTRUCTIONS:
      1.  **Format**: Use short paragraphs (max 3-4 sentences). Use bullet points for lists.
      2.  **Relevance**: Ensure all content is strictly derived from the source material.
      3.  **Detail**: Provide detailed explanations for complex concepts but keep them concise.
      4.  **Examples**: Include real-world examples where applicable.
    5.  **Detailed Notes**: For the 'detailedNotes' section, identify 3-5 major topics. For each, provide a comprehensive explanation and at least 2 concrete examples.
    6.  **Source Excerpt**: For each detailed note, include a short 'sourceExcerpt' (<=200 characters) that is an exact phrase or sentence from the original document that directly supports the note. This excerpt will be used to highlight the corresponding portion in the PDF viewer. Do NOT fabricate excerpts — if the exact excerpt cannot be found, use the closest short sentence from the source.
    `;

        const parts: any[] = [{ text: analysisPrompt }];

        if (mimeType === 'application/url') {
            // It's a URL
            parts.push({ text: `Video URL: ${input}` });
        } else if (mimeType.startsWith('text/')) {
            // Treat as raw text content (e.g., .py files, plain text)
            parts.push({ text: input });
        } else {
            // It's a Base64 file (binary documents/videos)
            // For PDFs we will attempt to extract text first and prefer sending the extracted text
            if (mimeType !== 'application/pdf') {
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: input,
                    },
                });
            }
        }

        // If the input is a PDF, try to extract text from it and send the extracted text to the model.
        if (mimeType === 'application/pdf') {
            try {
                let pdfBuffer: ArrayBuffer | null = null;
                if (input.startsWith('http://') || input.startsWith('https://')) {
                    const r = await fetch(input);
                    pdfBuffer = await r.arrayBuffer();
                } else if (input.startsWith('data:application/pdf;base64,')) {
                    const b64 = input.split(',')[1];
                    pdfBuffer = await arrayBufferFromBase64(b64);
                } else {
                    // assume raw base64 string
                    pdfBuffer = await arrayBufferFromBase64(input.replace(/^data:application\/(pdf);base64,/, '').replace(/\s+/g, ''));
                }

                if (pdfBuffer) {
                    const extracted = await extractTextFromPdfArrayBuffer(pdfBuffer, { maxChars: 120000, concurrency: 4 });
                    const pdfText = extracted.text || '';
                    if (pdfText && pdfText.trim().length > 50) {
                        // Insert the extracted text immediately after the analysis prompt so the model sees it first
                        parts.splice(1, 0, { text: `EXTRACTED_PDF_TEXT (${extracted.pages} pages)${extracted.truncated ? ' — TRUNCATED' : ''} :\n\n${pdfText}` });
                    } else {
                        // fallback: include inline data so the backend can process binary if needed
                        parts.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: input,
                            },
                        });
                    }
                }
            } catch (e) {
                console.warn('PDF preprocessing failed, falling back to inline data', e);
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: input,
                    },
                });
            }
        }

        const analysisResponse = await callGenAI(() => genai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                {
                    role: "user",
                    parts: parts,
                },
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: summarySchema,
            },
        }));

        const analysisData = analysisResponse.text;
        if (!analysisData) throw new Error("No analysis data generated");
        const parsedAnalysis = JSON.parse(analysisData);

        // Stage 2: Synthesis
        const synthesisPrompt = `
      Based on the following analysis, generate study materials:
      1. 5 Flashcards (Front/Back).
      2. 5 Quiz Questions (Multiple Choice).

      CRITICAL INSTRUCTIONS:
      - **Flashcards**: Front should be a concept/question, Back should be a detailed answer.
      - **Quiz**: 
          - Questions should test understanding, not just recall.
          - **Explanation**: Provide a detailed explanation for the correct answer, including *why* it is correct and why others are wrong.
      
      Analysis:
      ${JSON.stringify(parsedAnalysis)}
    `;

        const synthesisResponse = await callGenAI(() => genai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: synthesisPrompt }],
                },
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: studyMaterialSchema,
            },
        }));

        const synthesisData = synthesisResponse.text;
        if (!synthesisData) throw new Error("No synthesis data generated");
        const parsedSynthesis = JSON.parse(synthesisData);

        return {
            notes: parsedAnalysis.summary + "\n\n### Key Points\n" + parsedAnalysis.keyPoints.map((p: string) => `- ${p}`).join("\n"),
            flashcards: parsedSynthesis.flashcards,
            quiz: parsedSynthesis.quiz,
            detailedNotes: parsedAnalysis.detailedNotes || [],
        };

    } catch (error) {
        console.error("Gemini Pipeline Error:", error);
        throw error;
    }
};

export const generateStudyGuide = async (wrongAnswers: QuizQuestion[]): Promise<StudyGuide> => {
    try {
        const prompt = `
            The user got the following quiz questions wrong. 
            Create a personalized study guide to help them understand these concepts better.
            Provide clear explanations and examples.

            Wrong Questions:
            ${JSON.stringify(wrongAnswers)}
        `;

        const response = await callGenAI(() => genai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }],
                },
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: studyGuideSchema,
            },
        }));

        const data = response.text;
        if (!data) throw new Error("No study guide generated");
        return JSON.parse(data);

    } catch (error) {
        console.error("Study Guide Error:", error);
        throw error;
    }
};

export const chatWithAI = async (context: string, history: { role: string, text: string }[], userMessage: string) => {
    try {
        const systemPrompt = `
            You are an AI Study Assistant. 
            Answer the user's questions based on the following study material context.
            If the answer is not in the context, use your general knowledge but mention that it's outside the provided material.
            Be helpful, concise, and encouraging.

            Context:
            ${context}
        `;

        const chat = genai.chats.create({
            model: "gemini-2.0-flash",
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }],
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I am ready to help you with your study material." }],
                },
                ...history.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }))
            ],
        });

            // sendMessage can be rate-limited; wrap with callGenAI
            const result = await callGenAI(() => chat.sendMessage({ message: userMessage }));
        return result.text || "No response text generated.";

    } catch (error) {
        console.error("Chat Error:", error);
        throw error;
    }
};

export const generateStudyPlan = async (area: string, topic: string, level: string): Promise<StudyPlan> => {
    try {
        const prompt = `
            Create a comprehensive study plan for a student at the "${level}" level who wants to learn about "${topic}" (Area: ${area}).
            
            The plan should include:
            1. A 4-week Roadmap (Week number, Title, Description, Key Concepts).
            2. Recommended Resources (Books, Articles, or general search terms).

            Output JSON format:
            {
                "topic": "${topic}",
                "level": "${level}",
                "roadmap": [
                    { "week": 1, "title": "string", "description": "string", "keyConcepts": ["string"] }
                ],
                "resources": [
                    { "title": "string", "type": "Book/Video/Article", "url": "optional string", "description": "string" }
                ]
            }
        `;

        const response = await genai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: studyPlanSchema
            },
        });

        const data = response.text;
        console.log("Gemini Raw Response:", data);

        if (!data) throw new Error("No study plan generated");
        return JSON.parse(data);

    } catch (error) {
        console.error("Study Plan Error:", error);
        throw error;
    }
};
