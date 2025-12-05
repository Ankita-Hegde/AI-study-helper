import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Download, FileText, Layers, HelpCircle, CheckCircle, XCircle, BookOpen, Loader2, MessageSquare, Send } from 'lucide-react';
import { generateStudyGuide, chatWithAI } from '../services/geminiService';
import { QuizQuestion } from '../types';

export default function Results() {
    const location = useLocation();
    const navigate = useNavigate();
    const data = location.state?.data;
    const mediaUrl = location.state?.mediaUrl;
    const mediaType = location.state?.mediaType;

    const [activeTab, setActiveTab] = useState<'notes' | 'flashcards' | 'quiz' | 'chat'>('notes');

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
            // Extract video ID
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
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            );
        } else if (mediaType === 'application/pdf') {
            return (
                <iframe src={mediaUrl} className="w-full h-full" title="PDF Viewer"></iframe>
            );
        } else if (mediaType?.startsWith('video/')) {
            return (
                <video controls className="w-full h-full bg-black">
                    <source src={mediaUrl} type={mediaType} />
                    Your browser does not support the video tag.
                </video>
            );
        }
        return <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">Unsupported Media Type</div>;
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b px-6 py-3 flex items-center shadow-sm z-10">
                <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </button>
                <h1 className="text-lg font-semibold text-gray-800">Study Session</h1>
            </div>

            {/* Main Content - Split Screen */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Media Viewer */}
                <div className="w-1/2 bg-gray-900 border-r border-gray-200">
                    {renderMedia()}
                </div>

                {/* Right Panel - Study Materials */}
                <div className="w-1/2 flex flex-col bg-white">
                    {/* Tabs */}
                    <div className="flex border-b bg-gray-50">
                        <button
                            onClick={() => setActiveTab('notes')}
                            className={`flex-1 py-3 text-center font-medium flex items-center justify-center gap-2 text-sm ${activeTab === 'notes' ? 'border-b-2 border-indigo-500 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <FileText className="w-4 h-4" /> Notes
                        </button>
                        <button
                            onClick={() => setActiveTab('flashcards')}
                            className={`flex-1 py-3 text-center font-medium flex items-center justify-center gap-2 text-sm ${activeTab === 'flashcards' ? 'border-b-2 border-indigo-500 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Layers className="w-4 h-4" /> Flashcards
                        </button>
                        <button
                            onClick={() => setActiveTab('quiz')}
                            className={`flex-1 py-3 text-center font-medium flex items-center justify-center gap-2 text-sm ${activeTab === 'quiz' ? 'border-b-2 border-indigo-500 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <HelpCircle className="w-4 h-4" /> Quiz
                        </button>
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex-1 py-3 text-center font-medium flex items-center justify-center gap-2 text-sm ${activeTab === 'chat' ? 'border-b-2 border-indigo-500 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <MessageSquare className="w-4 h-4" /> Chat
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 relative">
                        {activeTab === 'notes' && (
                            <div>
                                <div className="flex justify-end mb-4 sticky top-0 bg-white/90 backdrop-blur py-2 z-10">
                                    <button onClick={downloadNotes} className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 transition">
                                        <Download className="w-3 h-3" /> Download MD
                                    </button>
                                </div>
                                <div className="prose prose-sm max-w-none">
                                    <ReactMarkdown>{data.notes}</ReactMarkdown>
                                </div>
                            </div>
                        )}

                        {activeTab === 'flashcards' && (
                            <div>
                                <div className="flex justify-end mb-4 sticky top-0 bg-white/90 backdrop-blur py-2 z-10">
                                    <button onClick={downloadFlashcards} className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 transition">
                                        <Download className="w-3 h-3" /> Download CSV
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
                                    {data.flashcards.map((fc: any, i: number) => (
                                        <div
                                            key={i}
                                            onClick={() => toggleCard(i)}
                                            className={`relative h-48 w-full cursor-pointer transition-all duration-500 transform preserve-3d ${flippedCards[i] ? 'rotate-y-180' : ''}`}
                                            style={{ perspective: '1000px' }}
                                        >
                                            {/* Front */}
                                            <div className={`absolute inset-0 backface-hidden bg-white border-2 border-indigo-100 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center hover:border-indigo-300 transition ${flippedCards[i] ? 'hidden' : 'flex'}`}>
                                                <h3 className="font-semibold text-gray-800 text-lg">{fc.front}</h3>
                                                <p className="absolute bottom-4 text-xs text-gray-400">Click to flip</p>
                                            </div>

                                            {/* Back */}
                                            <div className={`absolute inset-0 backface-hidden bg-indigo-50 border-2 border-indigo-200 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center rotate-y-180 ${flippedCards[i] ? 'flex' : 'hidden'}`}>
                                                <p className="text-indigo-800 font-medium">{fc.back}</p>
                                                <p className="absolute bottom-4 text-xs text-indigo-400">Click to flip back</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'quiz' && (
                            <div>
                                <div className="flex justify-end mb-4 sticky top-0 bg-white/90 backdrop-blur py-2 z-10">
                                    <button onClick={downloadQuiz} className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 transition">
                                        <Download className="w-3 h-3" /> Download Quiz
                                    </button>
                                </div>

                                {showResults && (
                                    <div className="mb-8 p-6 bg-indigo-50 rounded-xl text-center border border-indigo-100">
                                        <h3 className="text-2xl font-bold text-indigo-900 mb-2">Your Score: {score}%</h3>
                                        <p className="text-indigo-700 mb-4">
                                            {score === 100 ? "Perfect score! You've mastered this topic." : "Keep practicing to improve your score."}
                                        </p>
                                        {score < 100 && !studyGuide && (
                                            <button
                                                onClick={handleGenerateGuide}
                                                disabled={loadingGuide}
                                                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 mx-auto shadow-sm"
                                            >
                                                {loadingGuide ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                                                Generate Personalized Study Guide
                                            </button>
                                        )}
                                    </div>
                                )}

                                {studyGuide && (
                                    <div className="mb-8 p-6 bg-green-50 rounded-xl border border-green-200 shadow-sm">
                                        <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
                                            <BookOpen className="w-5 h-5" /> Study Guide
                                        </h3>
                                        <div className="prose prose-sm prose-green max-w-none">
                                            <ReactMarkdown>{studyGuide}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-8 pb-8">
                                    {data.quiz.map((q: QuizQuestion, i: number) => (
                                        <div key={i} className="border p-6 rounded-xl bg-white shadow-sm">
                                            <p className="font-semibold text-lg mb-4 text-gray-800">{i + 1}. {q.question}</p>
                                            <div className="space-y-3">
                                                {q.options.map((opt: string, j: number) => {
                                                    const isSelected = userAnswers[i] === opt;
                                                    const isCorrect = opt === q.correctAnswer;
                                                    let className = "p-3 rounded-lg border cursor-pointer transition flex items-center justify-between text-sm ";

                                                    if (showResults) {
                                                        if (isCorrect) className += "bg-green-50 border-green-500 text-green-900";
                                                        else if (isSelected && !isCorrect) className += "bg-red-50 border-red-500 text-red-900";
                                                        else className += "bg-gray-50 border-gray-200 opacity-60";
                                                    } else {
                                                        if (isSelected) className += "bg-indigo-50 border-indigo-500 text-indigo-900";
                                                        else className += "hover:bg-gray-50 border-gray-200";
                                                    }

                                                    return (
                                                        <div
                                                            key={j}
                                                            className={className}
                                                            onClick={() => !showResults && setUserAnswers(prev => ({ ...prev, [i]: opt }))}
                                                        >
                                                            <span>{opt}</span>
                                                            {showResults && isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
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
                                            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                        >
                                            Submit Quiz
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div className="flex flex-col h-full">
                                <div className="flex-1 overflow-y-auto space-y-4 p-4">
                                    {chatHistory.length === 0 && (
                                        <div className="text-center text-gray-500 mt-10">
                                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                            <p>Ask me anything about the study material!</p>
                                        </div>
                                    )}
                                    {chatHistory.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
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
                                <form onSubmit={handleChatSubmit} className="p-4 border-t bg-white flex gap-2">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Ask a question..."
                                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        disabled={chatLoading}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!chatInput.trim() || chatLoading}
                                        className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
