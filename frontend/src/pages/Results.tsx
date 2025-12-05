import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
    Menu, X, Share2, Maximize2, Download, CheckCircle, XCircle,
    BookOpen, Loader2, MessageSquare, Send, FileText, Layers,
    HelpCircle, Mic, Search, Clock, Brain, Map, ChevronDown
} from 'lucide-react';
import { generateStudyGuide, chatWithAI } from '../services/geminiService';
import { QuizQuestion } from '../types';

export default function Results() {
    const location = useLocation();
    const navigate = useNavigate();
    const data = location.state?.data;
    const mediaUrl = location.state?.mediaUrl;
    const mediaType = location.state?.mediaType;

    const [activeTab, setActiveTab] = useState<'chat' | 'flashcards' | 'quiz' | 'podcast' | 'summary'>('summary');
    const [showChapters, setShowChapters] = useState(true);
    const [autoScroll, setAutoScroll] = useState(false);

    // Quiz State
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState(0);
    const [studyGuide, setStudyGuide] = useState<string | null>(null);
    const [loadingGuide, setLoadingGuide] = useState(false);

    // Flashcard State
    const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

    // Chat State
    const [chatHistory, setChatHistory] = useState<{ role: string, text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, activeTab]);

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-xl mb-4">No data found.</p>
                    <button onClick={() => navigate('/')} className="text-blue-500 hover:underline">Go Home</button>
                </div>
            </div>
        );
    }

    // Extract document title from URL or file
    const getDocumentTitle = () => {
        if (mediaType === 'youtube') {
            return "Seeing as Much of Germany as We Can in 1 Day | Easy German 6...";
        }
        return "Study Document";
    };

    const downloadNotes = () => {
        const blob = new Blob([data.notes], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.md';
        a.click();
    };

    const downloadFlashcards = () => {
        const csvContent = "Front,Back\n" + data.flashcards.map((fc: any) => `"${fc.front}","${fc.back}"`).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flashcards.csv';
        a.click();
    };

    const downloadQuiz = () => {
        const textContent = data.quiz.map((q: any, i: number) =>
            `Q${i + 1}: ${q.question}\nOptions: ${q.options.join(', ')}\nAnswer: ${q.correctAnswer}\nExplanation: ${q.explanation}\n`
        ).join("\n---\n");
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quiz.txt';
        a.click();
    };

    const handleQuizSubmit = () => {
        let correctCount = 0;
        data.quiz.forEach((q: QuizQuestion, i: number) => {
            if (userAnswers[i] === q.correctAnswer) {
                correctCount++;
            }
        });
        setScore(Math.round((correctCount / data.quiz.length) * 100));
        setShowResults(true);
    };

    const handleGenerateGuide = async () => {
        setLoadingGuide(true);
        try {
            const wrongQuestions = data.quiz.filter((q: QuizQuestion, i: number) => userAnswers[i] !== q.correctAnswer);
            const guideData = await generateStudyGuide(wrongQuestions);
            setStudyGuide(guideData.guide);
        } catch (error) {
            console.error("Failed to generate guide", error);
        } finally {
            setLoadingGuide(false);
        }
    };

    const toggleCard = (index: number) => {
        setFlippedCards(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

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
                    className="w-full h-full rounded-lg"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            );
        } else if (mediaType === 'application/pdf') {
            return (
                <iframe src={mediaUrl} className="w-full h-full rounded-lg" title="PDF Viewer"></iframe>
            );
        } else if (mediaType?.startsWith('video/')) {
            return (
                <video controls className="w-full h-full bg-black rounded-lg">
                    <source src={mediaUrl} type={mediaType} />
                    Your browser does not support the video tag.
                </video>
            );
        }
        return <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">Unsupported Media Type</div>;
    };

    return (
        <div className="h-screen flex flex-col bg-white overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        <Menu className="w-5 h-5 text-gray-700" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center text-white font-bold text-sm">
                            YL
                        </div>
                        <h1 className="text-sm font-medium text-gray-900 max-w-md truncate">
                            {getDocumentTitle()}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        <X className="w-4 h-4 inline mr-1" />
                        Create Exam
                    </button>
                    <button className="px-4 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition font-medium">
                        Upgrade
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        <Share2 className="w-4 h-4 text-gray-700" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        <Maximize2 className="w-4 h-4 text-gray-700" />
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white border-b px-6 flex items-center gap-1 relative">
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-3 text-sm font-medium flex items-center gap-2 relative transition ${activeTab === 'chat' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    Chat
                    {activeTab === 'chat' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('flashcards')}
                    className={`px-4 py-3 text-sm font-medium flex items-center gap-2 relative transition ${activeTab === 'flashcards' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Layers className="w-4 h-4" />
                    Flashcards
                    {activeTab === 'flashcards' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('quiz')}
                    className={`px-4 py-3 text-sm font-medium flex items-center gap-2 relative transition ${activeTab === 'quiz' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <HelpCircle className="w-4 h-4" />
                    Quizzes
                    {activeTab === 'quiz' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('podcast')}
                    className={`px-4 py-3 text-sm font-medium flex items-center gap-2 relative transition ${activeTab === 'podcast' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Mic className="w-4 h-4" />
                    Podcast
                    {activeTab === 'podcast' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-4 py-3 text-sm font-medium flex items-center gap-2 relative transition ${activeTab === 'summary' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    Summary
                    {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>}
                </button>
                <div className="ml-auto flex items-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                        <Download className="w-4 h-4 text-gray-700" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Media & Chapters */}
                <div className="w-1/2 flex flex-col bg-gray-50 p-6 overflow-y-auto custom-scrollbar">
                    {/* Video Player */}
                    <div className="bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
                        {renderMedia()}
                    </div>

                    {/* Chapters/Transcripts Section */}
                    <div className="bg-white rounded-lg border border-gray-200 flex-1">
                        <div className="flex items-center border-b px-4 py-3">
                            <button
                                onClick={() => setShowChapters(true)}
                                className={`px-3 py-1.5 text-sm font-medium rounded transition ${showChapters ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                    Chapters
                                </div>
                            </button>
                            <button
                                onClick={() => setShowChapters(false)}
                                className={`px-3 py-1.5 text-sm font-medium rounded transition ${!showChapters ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Transcripts
                            </button>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    onClick={() => setAutoScroll(!autoScroll)}
                                    className={`px-3 py-1.5 text-xs rounded-lg border transition flex items-center gap-1 ${autoScroll ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <ChevronDown className="w-3 h-3" />
                                    Auto Scroll
                                </button>
                                <button className="p-1.5 hover:bg-gray-100 rounded transition">
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 text-center text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">Generating Chapters...</p>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Content */}
                <div className="w-1/2 flex flex-col bg-white overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {activeTab === 'summary' && (
                            <div className="max-w-3xl mx-auto">
                                <div className="prose prose-sm">
                                    <ReactMarkdown>{data.notes}</ReactMarkdown>
                                </div>
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div className="flex flex-col h-full max-w-3xl mx-auto">
                                {chatHistory.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                            <MessageSquare className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Learn with YouLearn</h3>
                                        <p className="text-gray-500 text-center mb-8">Ask me anything about the study material!</p>

                                        {/* Learning Tools Grid */}
                                        <div className="grid grid-cols-3 gap-4 mb-8">
                                            <button className="tool-button">
                                                <HelpCircle className="w-5 h-5 text-gray-600" />
                                                <span className="text-xs">Quiz</span>
                                            </button>
                                            <button className="tool-button">
                                                <Map className="w-5 h-5 text-gray-600" />
                                                <span className="text-xs">Mind Map</span>
                                            </button>
                                            <button className="tool-button">
                                                <Mic className="w-5 h-5 text-gray-600" />
                                                <span className="text-xs">Voice Mode</span>
                                            </button>
                                            <button className="tool-button">
                                                <Layers className="w-5 h-5 text-gray-600" />
                                                <span className="text-xs">Flashcards</span>
                                            </button>
                                            <button className="tool-button">
                                                <Search className="w-5 h-5 text-gray-600" />
                                                <span className="text-xs">Search</span>
                                            </button>
                                            <button className="tool-button">
                                                <Clock className="w-5 h-5 text-gray-600" />
                                                <span className="text-xs">Timeline</span>
                                            </button>
                                        </div>

                                        {/* Processing Indicator */}
                                        <div className="processing-indicator">
                                            <Brain className="w-4 h-4 text-gray-500" />
                                            <span>Processing...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 space-y-4 mb-4">
                                        {chatHistory.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user'
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                                </div>
                                            </div>
                                        ))}
                                        {chatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-gray-100 p-3 rounded-lg">
                                                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'flashcards' && (
                            <div className="max-w-2xl mx-auto">
                                <div className="grid grid-cols-1 gap-6">
                                    {data.flashcards.map((fc: any, i: number) => (
                                        <div
                                            key={i}
                                            onClick={() => toggleCard(i)}
                                            className="relative h-48 w-full cursor-pointer"
                                        >
                                            {!flippedCards[i] ? (
                                                <div className="absolute inset-0 bg-white border-2 border-gray-200 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center hover:border-emerald-300 hover:shadow-md transition">
                                                    <h3 className="font-semibold text-gray-800 text-lg">{fc.front}</h3>
                                                    <p className="absolute bottom-4 text-xs text-gray-400">Click to flip</p>
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 bg-emerald-50 border-2 border-emerald-200 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center">
                                                    <p className="text-emerald-900 font-medium">{fc.back}</p>
                                                    <p className="absolute bottom-4 text-xs text-emerald-500">Click to flip back</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'quiz' && (
                            <div className="max-w-3xl mx-auto">
                                {showResults && (
                                    <div className="mb-8 p-6 bg-emerald-50 rounded-xl text-center border border-emerald-200">
                                        <h3 className="text-2xl font-bold text-emerald-900 mb-2">Your Score: {score}%</h3>
                                        <p className="text-emerald-700 mb-4">
                                            {score === 100 ? "Perfect score! You've mastered this topic." : "Keep practicing to improve your score."}
                                        </p>
                                        {score < 100 && !studyGuide && (
                                            <button
                                                onClick={handleGenerateGuide}
                                                disabled={loadingGuide}
                                                className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2 mx-auto shadow-sm"
                                            >
                                                {loadingGuide ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                                                Generate Personalized Study Guide
                                            </button>
                                        )}
                                    </div>
                                )}

                                {studyGuide && (
                                    <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
                                        <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                                            <BookOpen className="w-5 h-5" /> Study Guide
                                        </h3>
                                        <div className="prose prose-sm prose-blue">
                                            <ReactMarkdown>{studyGuide}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6 pb-8">
                                    {data.quiz.map((q: QuizQuestion, i: number) => (
                                        <div key={i} className="border border-gray-200 p-6 rounded-xl bg-white shadow-sm">
                                            <p className="font-semibold text-lg mb-4 text-gray-800">{i + 1}. {q.question}</p>
                                            <div className="space-y-3">
                                                {q.options.map((opt: string, j: number) => {
                                                    const isSelected = userAnswers[i] === opt;
                                                    const isCorrect = opt === q.correctAnswer;
                                                    let className = "p-3 rounded-lg border cursor-pointer transition flex items-center justify-between text-sm ";

                                                    if (showResults) {
                                                        if (isCorrect) className += "bg-emerald-50 border-emerald-500 text-emerald-900";
                                                        else if (isSelected && !isCorrect) className += "bg-red-50 border-red-500 text-red-900";
                                                        else className += "bg-gray-50 border-gray-200 opacity-60";
                                                    } else {
                                                        if (isSelected) className += "bg-emerald-50 border-emerald-500 text-emerald-900";
                                                        else className += "hover:bg-gray-50 border-gray-200";
                                                    }

                                                    return (
                                                        <div
                                                            key={j}
                                                            className={className}
                                                            onClick={() => !showResults && setUserAnswers(prev => ({ ...prev, [i]: opt }))}
                                                        >
                                                            <span>{opt}</span>
                                                            {showResults && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                                                            {showResults && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {showResults && (
                                                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
                                                    <span className="font-semibold block mb-1">Explanation:</span> {q.explanation}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {!showResults && (
                                    <div className="mt-8 flex justify-center pb-8">
                                        <button
                                            onClick={handleQuizSubmit}
                                            disabled={Object.keys(userAnswers).length < data.quiz.length}
                                            className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                        >
                                            Submit Quiz
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'podcast' && (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <Mic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Podcast Feature</h3>
                                    <p className="text-gray-500">Coming soon...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat Input (shown only on chat tab) */}
                    {activeTab === 'chat' && (
                        <div className="border-t bg-white p-4">
                            <form onSubmit={handleChatSubmit} className="flex gap-2 max-w-3xl mx-auto">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Learn anything"
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-20 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                                        disabled={chatLoading}
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <button type="button" className="p-1.5 hover:bg-gray-100 rounded transition text-gray-500">
                                            Auto
                                        </button>
                                        <button type="button" className="p-1.5 hover:bg-gray-100 rounded transition">
                                            <ChevronDown className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <span className="text-xs text-gray-400">Add Context</span>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!chatInput.trim() || chatLoading}
                                    className="bg-emerald-500 text-white p-3 rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
