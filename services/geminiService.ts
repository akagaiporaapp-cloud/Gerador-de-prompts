
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, StyleCategory } from "../types";

export const analyzeImage = async (base64Image: string, category: StyleCategory = 'Geral/Misto'): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let categoryInstruction = "";
  if (category === 'Geral/Misto') {
    categoryInstruction = "Mantenha a representação mais autêntica para cada estilo individual.";
  } else if (category === 'História em Quadrinhos') {
    categoryInstruction = "Incline fortemente a estética geral para o estilo de 'História em Quadrinhos Ocidental' (traços fortes, poses de ação dinâmicas, pontos de retícula e sombras dramáticas de tinta). Mesmo estilos fotográficos ou pictóricos devem ter um toque de quadrinhos.";
  } else {
    categoryInstruction = `Ao seguir os requisitos únicos de cada estilo, incline fortemente a estética geral para a estética "${category}". Por exemplo, se a categoria for Anime, até mesmo um estilo de "Fotografia Realista" deve parecer um realismo de anime cinematográfico de alta qualidade.`;
  }

  const prompt = `Analise esta imagem em detalhes extremos. Identifique o assunto/personagem principal, suas roupas (cores, texturas, estilo), características faciais, o ambiente/paisagem, iluminação, atmosfera e perspectiva da câmera. 

  PREFERÊNCIA DO USUÁRIO: Foque a direção artística em "${category}".
  ${categoryInstruction}

  Em seguida, com base nesta análise, gere 30 prompts distintos e de alta qualidade para geração de imagens nos seguintes estilos específicos (os prompts devem estar em PORTUGUÊS DO BRASIL): 
  1. Paisagem Onírica Surreal e Etérea
  2. Pixel Art Retrô de 16 bits
  3. Pintura a Óleo Impressionista Vibrante
  4. Esboço Artístico Detalhado em Carvão e Grafite
  5. Arte Digital Cyberpunk
  6. Renderização 3D Moderna estilo Pixar
  7. Esboço Detalhado a Lápis
  8. Anime Estilo Studio Ghibli
  9. Fotografia Hiper-Realista
  10. Cena de Filme Cinematográfica
  11. Arte de Fantasia Sombria
  12. Arte Low Poly
  13. Estética Vaporwave
  14. Estilo de Gravura Japonesa Ukiyo-e
  15. Ilustração Art Nouveau
  16. Pintura de Retrato Gótico
  17. Design Plano Minimalista
  18. Neon Noir
  19. Arte Conceitual de Fantasia
  20. Estilo de História em Quadrinhos (Comics Ocidentais)
  21. Mangá Preto e Branco
  22. Ilustração Steampunk
  23. Arte de Terror Surreal
  24. Estúdio de Retrato Fotorrealista
  25. Pintura Matte (Fundo Cinematográfico)
  26. Ilustração em Aquarela
  27. Ilustração em Lavagem de Tinta (Estilo Sumi-e)
  28. Retrofuturismo
  29. Estilo Claymation (Animação em Massa)
  30. Glitch Art
  
  Formate a saída como um objeto JSON seguindo estritamente esta estrutura:
  {
    "detailedDescription": "Descrição detalhada da imagem original em português...",
    "prompts": [
      { "style": "Nome do Estilo em Português", "prompt": "O prompt detalhado em português...", "description": "Breve descrição do que torna este estilo único neste contexto em português" },
      ...
    ]
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] || base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detailedDescription: { type: Type.STRING },
          prompts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                style: { type: Type.STRING },
                prompt: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["style", "prompt", "description"]
            }
          }
        },
        required: ["detailedDescription", "prompts"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from AI");
  const parsed = JSON.parse(text);
  return { ...parsed, category };
};

export const translateResult = async (result: AnalysisResult): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Translate the following JSON content from Brazilian Portuguese (PT-BR) to English. 
  Keep the translations natural, artistic, and precise for image generation contexts.
  Do NOT translate the "style" names if they are already standard, but ensure the "detailedDescription", "prompts[].prompt", and "prompts[].description" are in English.
  
  JSON to translate:
  ${JSON.stringify({
    detailedDescription: result.detailedDescription,
    prompts: result.prompts.map(p => ({
      style: p.style,
      prompt: p.prompt,
      description: p.description
    }))
  })}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detailedDescription: { type: Type.STRING },
          prompts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                style: { type: Type.STRING },
                prompt: { type: Type.STRING },
                description: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Translation failed");
  const translatedData = JSON.parse(text);

  return {
    ...result,
    translatedDescription: translatedData.detailedDescription,
    prompts: result.prompts.map((p, idx) => ({
      ...p,
      translatedPrompt: translatedData.prompts[idx].prompt,
      translatedStyleDescription: translatedData.prompts[idx].description
    }))
  };
};

export const generateImageFromPrompt = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data found in response");
};
