
import React, { useState, useCallback, useEffect } from 'react';
import { Camera, Image as ImageIcon, Sparkles, Copy, Check, RefreshCcw, Download, Wand2, ArrowLeft, Files, ZoomIn, ZoomOut, X, Maximize2, ChevronDown, Languages, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import CameraView from './components/CameraView';
import { analyzeImage, generateImageFromPrompt, translateResult } from './services/geminiService';
import { AppState, AnalysisResult, GeneratedPrompt, StyleCategory } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedDescription, setCopiedDescription] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatingForPrompt, setGeneratingForPrompt] = useState<string | null>(null);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<StyleCategory>('General/Mixed');
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Fallback for local development or if platform tools aren't available
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const STYLES_LIST = [
    'Surreal Etéreo', 'Pixel Art 16-bit', 'Impressionista', 'Carvão e Grafite', 'Cyberpunk', 
    '3D Pixar', 'Esboço a Lápis', 'Studio Ghibli', 'Hiper-Realista', 'Cinematográfico', 
    'Fantasia Sombria', 'Low Poly', 'Vaporwave', 'Ukiyo-e', 'Art Nouveau', 
    'Retrato Gótico', 'Minimalista Flat', 'Neon Noir', 'Conceito de Fantasia', 'História em Quadrinhos', 
    'Mangá P&B', 'Steampunk', 'Terror Surreal', 'Estúdio Fotorrealista', 'Pintura Matte', 
    'Aquarela', 'Lavagem de Tinta', 'Retrofuturismo', 'Claymation', 'Glitch Art'
  ];

  const CATEGORIES: StyleCategory[] = ['Geral/Misto', 'Realista', 'Anime', '3D', 'Esboço Artístico', 'História em Quadrinhos'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setSelectedImage(base64);
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    setState(AppState.ANALYZING);
    setIsTranslated(false);
    try {
      const result = await analyzeImage(base64, selectedCategory);
      setAnalysis(result);
      setState(AppState.RESULT);
    } catch (error) {
      console.error(error);
      alert("Failed to analyze image. Please try again.");
      setState(AppState.IDLE);
    }
  };

  const handleTranslate = async () => {
    if (!analysis) return;
    
    // If we already have the translation, just toggle the view
    if (analysis.translatedDescription) {
      setIsTranslated(!isTranslated);
      return;
    }

    setIsTranslating(true);
    try {
      // Since we are now Portuguese by default, "translate" will go to English
      const prompt = `Translate the following JSON content from Brazilian Portuguese (PT-BR) to English. 
      Keep the translations natural, artistic, and precise for image generation contexts.
      Do NOT translate the "style" names if they are already standard, but ensure the "detailedDescription", "prompts[].prompt", and "prompts[].description" are in English.
      
      JSON to translate:
      ${JSON.stringify({
        detailedDescription: analysis.detailedDescription,
        prompts: analysis.prompts.map(p => ({
          style: p.style,
          prompt: p.prompt,
          description: p.description
        }))
      })}`;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

      setAnalysis({
        ...analysis,
        translatedDescription: translatedData.detailedDescription,
        prompts: analysis.prompts.map((p, idx) => ({
          ...p,
          translatedPrompt: translatedData.prompts[idx].prompt,
          translatedStyleDescription: translatedData.prompts[idx].description
        }))
      });
      setIsTranslated(true);
    } catch (error) {
      console.error(error);
      alert("A tradução falhou. Verifique sua conexão e tente novamente.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCapture = (base64: string) => {
    setSelectedImage(base64);
    processImage(base64);
  };

  const copyToClipboard = (text: string, style: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(style);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const copyDescription = () => {
    if (!analysis) return;
    const text = isTranslated && analysis.translatedDescription ? analysis.translatedDescription : analysis.detailedDescription;
    navigator.clipboard.writeText(text);
    setCopiedDescription(true);
    setTimeout(() => setCopiedDescription(false), 2000);
  };

  const copyAllToClipboard = () => {
    if (!analysis) return;
    const allPrompts = analysis.prompts
      .map(p => {
        const promptText = isTranslated && p.translatedPrompt ? p.translatedPrompt : p.prompt;
        const styleText = p.style;
        return `ESTILO: ${styleText}\nPROMPT: ${promptText}\n---`;
      })
      .join('\n\n');
    
    navigator.clipboard.writeText(allPrompts);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleGenerateImage = async (prompt: string, style: string) => {
    setGeneratingForPrompt(style);
    try {
      // Usamos o prompt atual (que pode ser PT ou EN dependendo do toggle)
      // Gemini 2.5 Flash Image lida bem com múltiplos idiomas, mas EN é geralmente mais preciso.
      const imageUrl = await generateImageFromPrompt(prompt);
      setGeneratedImageUrl(imageUrl);
      setState(AppState.GENERATING_IMAGE);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar imagem.");
    } finally {
      setGeneratingForPrompt(null);
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setAnalysis(null);
    setGeneratedImageUrl(null);
    setZoomLevel(1);
    setIsZoomModalOpen(false);
    setIsTranslated(false);
    setState(AppState.IDLE);
  };

  const toggleZoom = () => {
    setIsZoomModalOpen(!isZoomModalOpen);
    setZoomLevel(1);
  };

  const adjustZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(prev + delta, 0.5), 5));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isZoomModalOpen) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      adjustZoom(delta);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomModalOpen(false);
    };
    if (isZoomModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomModalOpen]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={reset}>
          <div className="p-2 bg-indigo-600 rounded-lg group-hover:rotate-12 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            PromptGenius AI
          </h1>
        </div>
        
        {state !== AppState.IDLE && hasApiKey && (
          <button 
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
          >
            <RefreshCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Recomeçar</span>
          </button>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {hasApiKey === false ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="p-4 bg-indigo-600/10 rounded-3xl border border-indigo-500/20">
              <Sparkles className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Configuração Necessária</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                Para garantir que você tenha acesso total e privado às gerações de IA, é necessário conectar sua própria chave de API do Google Gemini.
              </p>
            </div>
            
            <div className="space-y-4 w-full max-w-md">
              <button
                onClick={handleOpenKeySelector}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Conectar Minha Chave API
              </button>
              <p className="text-xs text-slate-500">
                Sua chave é armazenada de forma segura e nunca é exposta. 
                Você pode obter uma chave gratuita em <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">ai.google.dev</a>.
              </p>
            </div>
          </div>
        ) : hasApiKey === null ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {state === AppState.IDLE && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-4">
              <h2 className="text-4xl sm:text-7xl font-extrabold tracking-tight leading-tight">
                Da Foto para <br />
                <span className="text-indigo-500">30 Prompts de Mestre</span>
              </h2>
              <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto">
                Faça upload ou capture uma imagem. Nossa IA gera 30 prompts profissionais em estilos artísticos especializados para sua próxima criação.
              </p>
            </div>

            {/* Style Preference Selector */}
            <div className="w-full max-w-md space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center justify-center gap-2">
                <Sparkles className="w-3 h-3" />
                Selecione a Direção Artística Principal
              </label>
              <div className="relative">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as StyleCategory)}
                  className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:border-slate-600"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button
                onClick={() => setState(AppState.CAPTURING)}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Camera className="w-6 h-6" />
                Usar Câmera
              </button>
              
              <label className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-lg border border-slate-700 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]">
                <ImageIcon className="w-6 h-6" />
                Enviar Arquivo
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>

            <div className="space-y-4 w-full">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Sub-estilos Suportados</h4>
              <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                {STYLES_LIST.map((style) => (
                  <span key={style} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-medium text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors cursor-default">
                    {style}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {state === AppState.CAPTURING && (
          <CameraView onCapture={handleCapture} onClose={() => setState(AppState.IDLE)} />
        )}

        {state === AppState.ANALYZING && (
          <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
              <RefreshCcw className="w-16 h-16 text-indigo-500 animate-spin relative z-10" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Gerando 30 Estilos Artísticos...</h3>
              <p className="text-slate-400 max-w-xs mx-auto">O Gemini está aplicando 30 lentes artísticas distintas na direção <span className="text-indigo-400 font-bold">"{selectedCategory}"</span>.</p>
            </div>
          </div>
        )}

        {state === AppState.RESULT && analysis && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Zoom Modal */}
            {isZoomModalOpen && (
              <div 
                className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
                onWheel={handleWheel}
              >
                <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
                  <div className="bg-slate-900/80 border border-slate-700 rounded-full flex p-1 gap-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); adjustZoom(0.25); }} 
                      className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300"
                    >
                      <ZoomIn className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); adjustZoom(-0.25); }} 
                      className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-300"
                    >
                      <ZoomOut className="w-5 h-5" />
                    </button>
                  </div>
                  <button 
                    onClick={toggleZoom} 
                    className="p-3 bg-slate-900/80 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div 
                  className="w-full h-full flex items-center justify-center overflow-auto p-4 cursor-zoom-out" 
                  onClick={toggleZoom}
                >
                  <img 
                    src={selectedImage!} 
                    alt="Zoomed context" 
                    className="max-w-none transition-transform duration-200 shadow-2xl rounded-lg pointer-events-auto"
                    style={{ 
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md border border-slate-700 rounded-full text-xs text-slate-400">
                  Zoom: {Math.round(zoomLevel * 100)}% • Use a roda do mouse ou botões para inspecionar
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-24 space-y-4">
                  <div 
                    onClick={toggleZoom}
                    className="group relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl aspect-square sm:aspect-auto cursor-zoom-in"
                  >
                    <img src={selectedImage!} alt="Original" className="w-full h-auto object-cover max-h-[400px] transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                       <h4 className="font-bold text-indigo-400 flex items-center gap-2 text-xs uppercase tracking-widest">
                        <Sparkles className="w-3 h-3" />
                        {isTranslated ? 'Contexto em Inglês' : 'Contexto Detalhado'}
                      </h4>
                      <div className="flex items-center gap-2">
                        {analysis.category && (
                          <span className="text-[10px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-600/30">
                            {analysis.category}
                          </span>
                        )}
                        <button
                          onClick={copyDescription}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
                          title={isTranslated ? "Copy Description" : "Copiar Descrição"}
                        >
                          {copiedDescription ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed italic">
                      "{isTranslated && analysis.translatedDescription ? analysis.translatedDescription : analysis.detailedDescription}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h3 className="text-3xl font-bold">{isTranslated ? '30 Prompts em Inglês' : '30 Prompts Especializados'}</h3>
                    <p className="text-slate-500 text-sm">{isTranslated ? 'Versão original em inglês para máxima precisão' : 'Cada estilo otimizado para sua imagem'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className={`group flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border border-slate-700 active:scale-95 ${
                        isTranslated 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border-indigo-500' 
                          : 'bg-slate-800 hover:bg-slate-700 text-indigo-400'
                      }`}
                    >
                      {isTranslating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Languages className={`w-5 h-5 ${isTranslated ? 'animate-pulse' : ''}`} />
                      )}
                      <span>
                        {isTranslating ? 'Traduzindo...' : isTranslated ? 'Ver em Português' : 'Traduzir para Inglês'}
                      </span>
                    </button>
                    <button
                      onClick={copyAllToClipboard}
                      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all border border-slate-700 active:scale-95"
                    >
                      {copiedAll ? <Check className="w-5 h-5 text-green-400" /> : <Files className="w-5 h-5" />}
                      {copiedAll ? 'Copiado!' : 'Copiar Tudo'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {analysis.prompts.map((p, idx) => {
                    const currentPrompt = isTranslated && p.translatedPrompt ? p.translatedPrompt : p.prompt;
                    const currentDesc = isTranslated && p.translatedStyleDescription ? p.translatedStyleDescription : p.description;

                    return (
                      <div 
                        key={idx} 
                        className="group p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-700 group-hover:text-indigo-900/40 transition-colors w-6">{idx + 1}</span>
                            <div>
                              <h5 className="font-bold text-indigo-100">{p.style}</h5>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                {currentDesc}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyToClipboard(currentPrompt, p.style)}
                              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
                              title={isTranslated ? "Copiar Prompt" : "Copy Prompt"}
                            >
                              {copiedPromptId === p.style ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleGenerateImage(p.prompt, p.style)}
                              disabled={generatingForPrompt !== null}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white font-medium text-xs transition-all disabled:opacity-50 border border-slate-700"
                            >
                              {generatingForPrompt === p.style ? (
                                 <RefreshCcw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Wand2 className="w-3 h-3" />
                              )}
                              {generatingForPrompt === p.style ? (isTranslated ? 'Gerando...' : 'Generating...') : (isTranslated ? 'Prévia' : 'Preview')}
                            </button>
                          </div>
                        </div>
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 relative overflow-hidden">
                          {isTranslated && p.translatedPrompt && (
                             <div className="absolute top-0 right-0 px-2 py-0.5 bg-indigo-600/10 text-indigo-400 text-[8px] font-bold uppercase tracking-tighter rounded-bl">Inglês</div>
                          )}
                          <p className="text-slate-400 text-sm italic leading-relaxed">
                            {currentPrompt}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {state === AppState.GENERATING_IMAGE && generatedImageUrl && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setState(AppState.RESULT)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                {isTranslated ? 'Voltar para Lista' : 'Back to Style List'}
              </button>
              <h3 className="text-2xl font-bold text-indigo-400">Visualização Gemini</h3>
            </div>

            <div className="relative group rounded-[2rem] overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-900 aspect-square">
               <img src={generatedImageUrl} alt="Gerado" className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                  <div className="flex gap-4 w-full">
                    <a 
                      href={generatedImageUrl} 
                      download="promptgenius-obra-prima.png"
                      className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors shadow-xl"
                    >
                      <Download className="w-5 h-5" />
                      Salvar Obra-prima
                    </a>
                  </div>
               </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                Esta prévia foi gerada usando o Gemini 2.5 Flash Image. O sistema utilizou o prompt atual para a geração artística.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setState(AppState.RESULT)}
                  className="flex-1 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Retornar aos Estilos
                </button>
                <button 
                  onClick={reset}
                  className="flex-1 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold transition-all"
                >
                  Analisar Nova Foto
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )}
  </main>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-slate-800 text-center text-slate-500 text-xs">
        <p>© {new Date().getFullYear()} PromptGenius AI • Mais de 30 Lentes Artísticas Avançadas</p>
      </footer>
    </div>
  );
};

export default App;
