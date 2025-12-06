import { GoogleGenAI, Type } from "@google/genai";
import { StudyData, QuizQuestion, StudyGuide } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genai = new GoogleGenAI({ apiKey });

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

export const runFullPipeline = async (
    input: string,
    mimeType: string
): Promise<StudyData> => {
    try {
        let context = "";
        if (mimeType === 'text/plain') {
            // It's a URL
            const metadata = await fetchVideoMetadata(input);
            if (metadata) {
                context = `\nVideo Metadata:\n${metadata}`;
            }
            context += "\nNOTE: This is a YouTube URL. If you cannot access the video content directly, use the provided metadata and your internal knowledge to generate the best possible summary. DO NOT HALLUCINATE information not present in the video.";
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
    `;

        const parts: any[] = [{ text: analysisPrompt }];

        if (mimeType === 'text/plain') {
            // It's a URL
            parts.push({ text: `Video URL: ${input}` });
        } else {
            // It's a Base64 file
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: input,
                },
            });
        }

        const analysisResponse = await genai.models.generateContent({
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
        });

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

        const synthesisResponse = await genai.models.generateContent({
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
        });

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

        const response = await genai.models.generateContent({
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
        });

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

        const result = await chat.sendMessage({ message: userMessage });
        return result.text || "No response text generated.";

    } catch (error) {
        console.error("Chat Error:", error);
        throw error;
    }
};
