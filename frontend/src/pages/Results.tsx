
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import PdfViewer from '../components/PdfViewer';
import {
    BookOpen, Loader2, MessageSquare, Send, Layers, HelpCircle, Plus, Minus,
    Mic, Maximize2, Minimize2
} from 'lucide-react';
import { chatWithAI, generateStudyGuide } from '../services/geminiService';
import { QuizQuestion } from '../types';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export default function Results() {
    const location = useLocation();
    const navigate = useNavigate();
    const data = location.state?.data;
    const mediaUrl = location.state?.mediaUrl;
    const mediaType = location.state?.mediaType;

    const [activeTab, setActiveTab] = useState<'chat' | 'flashcards' | 'quiz' | 'notes'>('chat');
    const isPdf = mediaType === 'application/pdf';

    // Flashcard State
    const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

    // Quiz State
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);

    // Study Guide State
    const [studyGuide, setStudyGuide] = useState<string | null>(null);
    const [generatingGuide, setGeneratingGuide] = useState(false);

    const handleOptionSelect = (questionIndex: number, option: string) => {
        setSelectedAnswers(prev => ({
            ...prev,
            [questionIndex]: option
        }));
    };

    const handleSubmitQuiz = () => {
        setQuizSubmitted(true);
    };

    const resetQuiz = () => {
        setSelectedAnswers({});
        setQuizSubmitted(false);
        setStudyGuide(null);
    };

    const calculateScore = () => {
        let score = 0;
        data.quiz.forEach((q: QuizQuestion, i: number) => {
            if (selectedAnswers[i] === q.correctAnswer) {
                score++;
            }
        });
        return score;
    };

    const handleGenerateGuide = async () => {
        setGeneratingGuide(true);
        try {
            const wrongAnswers = data.quiz.filter((q: QuizQuestion, i: number) => selectedAnswers[i] !== q.correctAnswer);

            if (wrongAnswers.length === 0) {
                setStudyGuide("## Great Job! \n\nYou got a perfect score, so you don't need a specific study guide for mistakes. Keep up the good work!");
            } else {
                const result = await generateStudyGuide(wrongAnswers);
                setStudyGuide(result.guide);
            }
        } catch (error) {
            console.error("Failed to generate guide", error);
            setStudyGuide("Sorry, failed to generate the study guide. Please try again.");
        } finally {
            setGeneratingGuide(false);
        }
    };

    // Chat State
    const [chatHistory, setChatHistory] = useState<{ role: string, text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [codeText, setCodeText] = useState<string | null>(null);
    const [codeMinimized, setCodeMinimized] = useState(false);
    const [pdfScale, setPdfScale] = useState(1.5);
    const pdfViewerRef = useRef<any>(null);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, activeTab]);

    useEffect(() => {
        // If media is a text file (e.g., python source), fetch its text for display
        const loadText = async () => {
            if (mediaUrl && mediaType && mediaType.startsWith('text/')) {
                try {
                    const resp = await fetch(mediaUrl);
                    const txt = await resp.text();
                    setCodeText(txt);
                } catch (e) {
                    console.error('Failed to load text media', e);
                    setCodeText(null);
                }
            } else {
                setCodeText(null);
            }
        };
        loadText();
    }, [mediaUrl, mediaType]);

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-xl mb-4">No data found.</p>
                    <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">Go Home</button>
                </div>
            </div>
        );
    }

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || chatLoading) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);

        try {
            const response = await chatWithAI(data.notes, chatHistory, userMsg);
            setChatHistory(prev => [...prev, { role: 'model', text: response }]);
        } catch (error) {
            console.error("Chat failed", error);
            setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setChatLoading(false);
        }
    };

    const renderMedia = () => {
        if (!mediaUrl) return <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">No Media Available</div>;

        if (mediaType === 'youtube') {
            let videoId = '';
            try {
                const urlObj = new URL(mediaUrl);
                if (urlObj.hostname.includes('youtube.com')) {
                    videoId = urlObj.searchParams.get('v') || '';
                } else if (urlObj.hostname.includes('youtu.be')) {
                    videoId = urlObj.pathname.slice(1);
                }
            } catch (e) { console.error("Invalid URL", e); }

            return (
                <iframe
                    className="w-full h-full rounded-xl"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe >
            );
        } else if (mediaType === 'application/pdf') {
            // Render PDF with our PdfViewer so we can highlight references
            return (
                <div className="w-full h-full rounded-xl bg-white overflow-hidden relative p-4">
                    {/* Controls overlay (top-right) */}
                    <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
                        <button
                            onClick={() => setPdfScale(prev => Math.max(0.5, +(prev / 1.25).toFixed(2)))}
                            title="Zoom out"
                            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-md hover:scale-105 transition-transform"
                        >
                            <Minus className="w-5 h-5 text-slate-700" />
                        </button>
                        <div className="px-3 py-2 bg-white/90 rounded-full text-sm font-medium shadow-sm">{Math.round(pdfScale * 100)}%</div>
                        <button
                            onClick={() => setPdfScale(prev => Math.min(4, +(prev * 1.25).toFixed(2)))}
                            title="Zoom in"
                            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-md hover:scale-105 transition-transform"
                        >
                            <Plus className="w-5 h-5 text-slate-700" />
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    if (!viewerRef.current || !viewerRef.current.exportAnnotatedPdf) {
                                        console.warn('Pdf viewer export not available');
                                        return;
                                    }
                                    await viewerRef.current.exportAnnotatedPdf('highlighted.pdf');
                                } catch (e) {
                                    console.error('Download highlighted PDF failed', e);
                                }
                            }}
                            title="Download highlighted PDF"
                            className="ml-2 w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-md hover:scale-105 transition-transform"
                        >
                            <BookOpen className="w-4 h-4 text-slate-700" />
                        </button>
                    </div>

                    <div className="w-full h-full rounded-xl bg-white overflow-y-auto overflow-x-hidden pdf-viewer-container" style={{ height: '100%' }}>
                        {/* PdfViewer will render pages and overlays; pass current scale */}
                            <PdfViewerWrapper mediaUrl={mediaUrl} notes={data.notes} detailedNotes={data.detailedNotes} scale={pdfScale} viewerRef={pdfViewerRef} />
                    </div>
                </div>
            );
        } else if (mediaType?.startsWith('video/')) {
            return (
                <video controls className="w-full h-full bg-black rounded-xl">
                    <source src={mediaUrl} type={mediaType} />
                    Your browser does not support the video tag.
                </video>
            );
        } else if (mediaType?.startsWith('text/')) {
            return (
                    <div className="w-full h-full rounded-xl bg-slate-900 text-white overflow-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-medium flex items-center gap-3">
                                <span>{mediaType}</span>
                                <span className="text-xs text-slate-400">{mediaUrl?.split('/').pop()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        try {
                                            const resp = await fetch(mediaUrl);
                                            const txt = await resp.text();
                                            const blob = new Blob([txt], { type: mediaType });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = 'file.txt';
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                        } catch (e) {
                                            console.error('Download failed', e);
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm"
                                >
                                    Download
                                </button>

                                <button
                                    onClick={() => setCodeMinimized(prev => !prev)}
                                    title={codeMinimized ? 'Maximize code' : 'Minimize code'}
                                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                                >
                                    {codeMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {codeMinimized ? (
                            <div className="w-full rounded-xl bg-slate-900 text-white p-4">
                                <div className="text-xs text-slate-300 mb-2">Preview</div>
                                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed max-h-24 overflow-hidden">{(codeText && codeText.split('\n').slice(0, 8).join('\n')) ?? 'Loading...'}</pre>
                            </div>
                        ) : (
                            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{codeText ?? 'Loading...'}</pre>
                        )}
                    </div>
            );
        }
        return <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">Unsupported Media Type</div>;
    };

    return (
        <div className="h-screen flex flex-col bg-white overflow-hidden font-sans text-slate-800">
            {/* Header */}
            <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <img src="/logo.png" alt="AISH Logo" className="w-6 h-6 object-contain" />
                    </div>
                    <span className="font-bold text-xl text-slate-800 tracking-tight">AI Study Helper</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const element = document.getElementById('study-notes-content');
                            if (!element) return;
                            const opt = {
                                margin: 1,
                                filename: 'study-notes.pdf',
                                image: { type: 'jpeg' as const, quality: 0.98 },
                                html2canvas: { scale: 2 },
                                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
                            };
                            html2pdf().set(opt).from(element).save();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-slate-200 hover:shadow-xl"
                    >
                        <BookOpen className="w-4 h-4" />
                        Download PDF
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Panel */}
                <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
                    {/* Video Section */}
                    <div className={`${isPdf ? 'h-[60%]' : 'h-[55%]'} bg-slate-50 p-6 flex flex-col`}> 
                        <div className={`flex-1 ${isPdf ? 'bg-white' : 'bg-black'} rounded-xl shadow-lg overflow-hidden relative group` }>
                            {renderMedia()}
                            <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className={`w-2 h-2 ${mediaType === 'application/pdf' ? 'bg-blue-500' : 'bg-red-500'} rounded-full animate-pulse`}></span>
                                {mediaType === 'application/pdf' ? 'Viewing PDF' : mediaType === 'youtube' ? 'Watch on YouTube' : 'Watch Video'}
                            </div>
                        </div>
                    </div>

                    {/* Transcript Section */}
                        <div className={`flex-1 flex flex-col min-h-0 bg-white ${isPdf ? 'p-6' : ''}`}>
                        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-800">{mediaType === 'application/pdf' ? 'Summary' : 'Transcripts'}</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div id="study-notes-content" className={`prose max-w-none ${isPdf ? 'prose-lg text-base' : 'prose-sm'}`}>
                                <ReactMarkdown
                                    components={{
                                        h1: ({ children }) => <h3 className="text-lg font-bold text-slate-800 mt-6 mb-3 flex items-center gap-2"><span className="text-blue-500">#</span> {children}</h3>,
                                        h2: ({ children }) => <h4 className="text-base font-semibold text-slate-700 mt-4 mb-2 border-l-2 border-blue-200 pl-3">{children}</h4>,
                                        ul: ({ children }) => <ul className="space-y-2 my-4">{children}</ul>,
                                        li: ({ children }) => <li className="flex items-start gap-2 text-slate-600"><span className="mt-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span><span>{children}</span></li>,
                                        p: ({ children }) => <p className="text-slate-600 leading-relaxed mb-4">{children}</p>,
                                        strong: ({ children }) => <span className="font-semibold text-blue-700 bg-blue-50 px-1 rounded">{children}</span>
                                    }}
                                >
                                    {data.notes}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="w-1/2 flex flex-col bg-slate-50/30">
                    {/* Tabs */}
                    <div className="px-6 pt-4 pb-2">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                            {[
                                { id: 'chat', icon: MessageSquare, label: 'Chat' },
                                { id: 'flashcards', icon: Layers, label: 'Flashcards' },
                                { id: 'quiz', icon: HelpCircle, label: 'Quizzes' },
                                { id: 'notes', icon: BookOpen, label: 'Notes' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                                        ${activeTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden relative flex flex-col">
                        {activeTab === 'chat' ? (
                            <>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {chatHistory.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                                                <div className="text-white font-bold text-2xl"><img src="/logo.png" alt="AISH Logo" className="w-6 h-6 object-contain" /></div>
                                            </div>
                                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Learn with AI Study Helper</h2>
                                            <p className="text-slate-500 mb-8 max-w-md">Ask questions, generate quizzes, or explore your study material with AI assistance.</p>

                                            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                                                {[
                                                    { icon: HelpCircle, label: 'Quiz' },
                                                    { icon: Layers, label: 'Flashcards' }
                                                ].map((action, i) => (
                                                    <button key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left group">
                                                        <action.icon className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{action.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        chatHistory.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${msg.role === 'user'
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none'
                                                    }`}>
                                                    <div className={msg.role === 'user' ? 'prose-invert' : 'prose-sm'}>
                                                        <ReactMarkdown>
                                                            {msg.text}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-none shadow-sm">
                                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                                <div className="p-4 bg-white border-t border-slate-100">
                                    <form onSubmit={handleChatSubmit} className="relative">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Ask anything..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-6 pr-14 py-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!chatInput.trim() || chatLoading}
                                            className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                        >
                                            <Send className="w-5 h-5" />
                                        </button>
                                    </form>
                                    <div className="flex justify-between items-center mt-3 px-2">
                                        <div className="flex gap-4">
                                            <button className="text-xs font-medium text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-green-400"></span> Auto
                                            </button>
                                            <button className="text-xs font-medium text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                                <Plus className="w-3 h-3" /> Add Context
                                            </button>
                                        </div>
                                        <div className="flex gap-3">
                                            <button className="text-slate-400 hover:text-slate-600"><Mic className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : activeTab === 'flashcards' ? (
                            <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center bg-slate-50">
                                <div className="w-full max-w-md space-y-6">
                                    {data.flashcards.map((fc: any, i: number) => (
                                        <div
                                            key={i}
                                            onClick={() => setFlippedCards(prev => ({ ...prev, [i]: !prev[i] }))}
                                            className={`border rounded-2xl p-8 min-h-[200px] flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition-all relative group
                                                ${flippedCards[i]
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-slate-200 text-slate-800'
                                                }`}
                                        >
                                            <p className={`text-lg font-medium ${flippedCards[i] ? 'text-white' : 'text-slate-800'}`}>
                                                {flippedCards[i] ? fc.back : fc.front}
                                            </p>
                                            <p className={`text-xs mt-4 font-medium uppercase tracking-wider ${flippedCards[i] ? 'text-blue-200' : 'text-slate-400'}`}>
                                                {flippedCards[i] ? 'Answer' : 'Question'}
                                            </p>
                                            <div className={`absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                <div className={`p-2 rounded-full ${flippedCards[i] ? 'bg-blue-500 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                                                    <Layers className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : activeTab === 'quiz' ? (
                            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                                <div className="max-w-2xl mx-auto space-y-6">
                                    {quizSubmitted && (
                                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 text-center animate-in fade-in slide-in-from-top-4">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Quiz Results</h3>
                                            <div className="text-4xl font-black text-blue-600 mb-4">
                                                {calculateScore()} / {data.quiz.length}
                                            </div>
                                            <p className="text-slate-500 mb-6">
                                                {calculateScore() === data.quiz.length
                                                    ? "Perfect score! You've mastered this topic."
                                                    : "Good effort! Review the explanations below to learn more."}
                                            </p>
                                            <button
                                                onClick={resetQuiz}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                                            >
                                                Retake Quiz
                                            </button>

                                            {!studyGuide && !generatingGuide && (
                                                <div className="mt-6 pt-6 border-t border-slate-100">
                                                    <p className="text-sm text-slate-500 mb-3">Want to improve? Generate a personalized guide based on your mistakes.</p>
                                                    <button
                                                        onClick={handleGenerateGuide}
                                                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-blue-200 text-blue-700 rounded-xl font-medium hover:bg-blue-50 hover:border-blue-300 transition-all mx-auto shadow-sm"
                                                    >
                                                        <BookOpen className="w-4 h-4" />
                                                        Generate Study Guide
                                                    </button>
                                                </div>
                                            )}

                                            {generatingGuide && (
                                                <div className="mt-6 flex flex-col items-center justify-center text-slate-500">
                                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                                                    <span className="text-sm">Creating your personalized study plan...</span>
                                                </div>
                                            )}

                                            {studyGuide && (
                                                <div className="mt-8 text-left bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                            Your Personalized Study Guide
                                                        </h4>
                                                        <button
                                                            onClick={() => {
                                                                const element = document.createElement("a");
                                                                const file = new Blob([studyGuide], { type: 'text/plain' });
                                                                element.href = URL.createObjectURL(file);
                                                                element.download = "personalized-guide.md";
                                                                document.body.appendChild(element);
                                                                element.click();
                                                            }}
                                                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                                        >
                                                            <BookOpen className="w-3 h-3" /> Download
                                                        </button>
                                                    </div>
                                                    <div className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded-xl border border-blue-100/50 shadow-sm">
                                                        <ReactMarkdown>{studyGuide}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {data.quiz.map((q: QuizQuestion, i: number) => (
                                        <div key={i} className={`bg-white border rounded-2xl p-6 shadow-sm transition-all ${quizSubmitted
                                            ? selectedAnswers[i] === q.correctAnswer
                                                ? 'border-green-200 bg-green-50/30'
                                                : 'border-red-200 bg-red-50/30'
                                            : 'border-slate-200'
                                            }`}>
                                            <h3 className="font-bold text-slate-800 mb-4 flex gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${quizSubmitted
                                                    ? selectedAnswers[i] === q.correctAnswer
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {i + 1}
                                                </span>
                                                {q.question}
                                            </h3>
                                            <div className="space-y-2 pl-9">
                                                {q.options.map((opt, j) => {
                                                    const isSelected = selectedAnswers[i] === opt;
                                                    const isCorrect = opt === q.correctAnswer;

                                                    let optionClass = "p-3 border rounded-lg text-sm transition-all flex items-center justify-between ";

                                                    if (quizSubmitted) {
                                                        if (isCorrect) {
                                                            optionClass += "bg-green-100 border-green-300 text-green-800 font-medium";
                                                        } else if (isSelected) {
                                                            optionClass += "bg-red-100 border-red-300 text-red-800";
                                                        } else {
                                                            optionClass += "bg-white border-slate-100 text-slate-400 opacity-60";
                                                        }
                                                    } else {
                                                        if (isSelected) {
                                                            optionClass += "bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500";
                                                        } else {
                                                            optionClass += "bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer";
                                                        }
                                                    }

                                                    return (
                                                        <div
                                                            key={j}
                                                            onClick={() => !quizSubmitted && handleOptionSelect(i, opt)}
                                                            className={optionClass}
                                                        >
                                                            <span>{opt}</span>
                                                            {quizSubmitted && isCorrect && <span className="text-green-600 font-bold">✓</span>}
                                                            {quizSubmitted && isSelected && !isCorrect && <span className="text-red-500 font-bold">✗</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {quizSubmitted && (
                                                <div className="mt-4 ml-9 p-4 bg-white/50 rounded-xl border border-slate-200/60 text-sm">
                                                    <p className="font-semibold text-slate-700 mb-1">Explanation:</p>
                                                    <p className="text-slate-600">{q.explanation}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {!quizSubmitted && (
                                        <div className="flex justify-end pt-4 pb-8">
                                            <button
                                                onClick={handleSubmitQuiz}
                                                disabled={Object.keys(selectedAnswers).length < data.quiz.length}
                                                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                            >
                                                Submit Answers
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                                <div className="max-w-3xl mx-auto space-y-8">
                                    {data.detailedNotes && data.detailedNotes.length > 0 ? (
                                        data.detailedNotes.map((note: any, i: number) => (
                                            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                                                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-3">
                                                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                                                        {i + 1}
                                                    </span>
                                                    {note.topic}
                                                </h3>
                                                <p className="text-slate-600 leading-relaxed mb-6">
                                                    {note.explanation}
                                                </p>
                                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                                    <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                        Examples
                                                    </h4>
                                                    <ul className="space-y-3">
                                                        {note.examples.map((example: string, j: number) => (
                                                            <li key={j} className="flex items-start gap-3 text-slate-600 text-sm">
                                                                <span className="mt-1.5 w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0"></span>
                                                                <span>{example}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <BookOpen className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <h3 className="text-lg font-medium text-slate-900 mb-2">No Detailed Notes Available</h3>
                                            <p className="text-slate-500 max-w-sm mx-auto">
                                                Try generating new study material to get detailed notes with examples.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Simple wrapper that instantiates PdfViewer and asks it to highlight key phrases
function PdfViewerWrapper({ mediaUrl, notes, detailedNotes, scale = 1.5, viewerRef }: { mediaUrl: string, notes: string, detailedNotes: any[], scale?: number, viewerRef?: any }) {
    const internalRef = useRef<any>(null);
    const refToUse = viewerRef || internalRef;

    useEffect(() => {
        const run = async () => {
            if (!refToUse.current) return;
            // derive phrases to search: use key points lines and detailed note topics
            const phrases: string[] = [];
            if (notes) {
                // take first 5 sentences as phrases
                const sents = notes.split(/[\.\n]+/).map(s => s.trim()).filter(Boolean);
                for (let i = 0; i < Math.min(6, sents.length); i++) phrases.push(sents[i]);
            }
            if (Array.isArray(detailedNotes)) {
                detailedNotes.slice(0,5).forEach((d: any) => {
                    // Prefer exact source excerpt when available for precise highlighting
                    if (d.sourceExcerpt && typeof d.sourceExcerpt === 'string' && d.sourceExcerpt.trim().length > 3) {
                        phrases.push(d.sourceExcerpt.trim());
                        return;
                    }
                    if (d.topic) phrases.push(d.topic);
                    if (d.explanation) phrases.push((d.explanation||'').split('\n')[0]);
                });
            }

            try {
                await refToUse.current.findAndHighlight(phrases);
            } catch (e) {
                console.warn('PDF highlight failed', e);
            }
        };
        run();
    }, [mediaUrl, notes, detailedNotes, scale]);

    return <PdfViewer ref={refToUse} url={mediaUrl} className="h-full" scale={scale} />;
}
