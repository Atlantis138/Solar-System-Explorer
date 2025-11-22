
import { GoogleGenAI } from "@google/genai";
import { SearchResponse } from "../types";

// We use the process.env.API_KEY as required.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const askGeminiAboutSpace = async (query: string): Promise<SearchResponse> => {
  try {
    const model = 'gemini-2.5-flash';
    
    // The prompt includes instructions to be concise and focus on space facts
    const contents = `Search and answer clearly in Chinese: ${query}`;

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        tools: [{ googleSearch: {} }], // Enable search grounding
      },
    });

    const text = response.text || "抱歉，我无法获取该信息。";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      text,
      groundingChunks: groundingChunks.map((chunk: any) => ({
        web: chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : undefined,
      })).filter((c: any) => c.web)
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      text: "获取数据时发生错误。请检查网络或API Key配置。\n(Error fetching data. Please check network or API Key.)",
      groundingChunks: []
    };
  }
};
