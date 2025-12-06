import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, MessageSquare, ArrowLeft, Loader2, Send, ExternalLink, GraduationCap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateStudyPlan, chatWithAI, StudyPlan } from '../services/geminiService';

export default function StudyDashboard() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'plan' | 'materials' | 'chat'>('plan');

    // Data States
    const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Chat State
    const [chatHistory, setChatHistory] = useState<{ role: string, text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedProfile = localStorage.getItem('user_study_profile');
        if (!savedProfile) {
            navigate('/study-setup');
            return;
        }
        setProfile(JSON.parse(savedProfile));
    }, [navigate]);

    useEffect(() => {
        if (profile && !studyPlan) {
            loadStudyPlan();
        }
    }, [profile]);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, activeTab]);

    const loadStudyPlan = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await generateStudyPlan(profile.area, profile.topic, profile.level);
            setStudyPlan(data);
        } catch (error: any) {
            console.error(error);
            setError(error.message || "Failed to generate study plan. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || chatLoading) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);

        try {
            // Context for the chat includes the study plan details
            const context = `
                Topic: ${studyPlan?.topic}
                Level: ${studyPlan?.level}
                Roadmap: ${JSON.stringify(studyPlan?.roadmap)}
            `;
            const response = await chatWithAI(context, chatHistory, userMsg);
            setChatHistory(prev => [...prev, { role: 'model', text: response }]);
        } catch (error) {
            console.error("Chat failed", error);
            setChatHistory(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setChatLoading(false);
        }
    };

    if (!profile) return null;

    return (
        <div className="relative min-h-screen font-sans text-slate-800 flex flex-col overflow-hidden">
            {/* Hero Background */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/hero-bg.png"
                    alt="Background"
                    className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-slate-900/40 backdrop-blur-[2px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {profile.topic}
                        </h1>
                        <p className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-0.5 rounded mt-1">{profile.level} • {profile.area}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 max-w-5xl mx-auto w-full p-6 flex flex-col">

                {/* Tabs */}
                <div className="flex p-1 bg-white rounded-xl border border-slate-200 mb-8 shadow-sm">
                    {[
                        { id: 'plan', label: 'Study Plan', icon: Calendar },
                        { id: 'materials', label: 'Materials', icon: BookOpen },
                        { id: 'chat', label: 'AI Tutor', icon: MessageSquare },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all
                                ${activeTab === tab.id
                                    ? 'bg-slate-800 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                {error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-red-50 p-4 rounded-full mb-4">
                            <Loader2 className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Something went wrong</h3>
                        <p className="text-slate-500 max-w-md mb-6">{error}</p>
                        <button
                            onClick={loadStudyPlan}
                            className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : loading && !studyPlan ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
                        <p>Generating your personalized study plan...</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* PLAN TAB */}
                        {activeTab === 'plan' && studyPlan && (
                            <div className="space-y-6">
                                <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-lg shadow-blue-200">
                                    <h2 className="text-2xl font-bold mb-2">Your 4-Week Roadmap</h2>
                                    <p className="text-blue-100 opacity-90">A structured path to master {studyPlan.topic}.</p>
                                </div>

                                <div className="grid gap-6">
                                    {studyPlan.roadmap.map((week, i) => (
                                        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex gap-6">
                                            <div className="flex-shrink-0 flex flex-col items-center">
                                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                                    {week.week}
                                                </div>
                                                <div className="h-full w-0.5 bg-blue-100 mt-4"></div>
                                            </div>
                                            <div className="flex-1 pb-6">
                                                <h3 className="text-xl font-bold text-slate-800 mb-2">{week.title}</h3>
                                                <p className="text-slate-600 mb-4">{week.description}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {week.keyConcepts.map((concept, j) => (
                                                        <span key={j} className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
                                                            {concept}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* MATERIALS TAB */}
                        {activeTab === 'materials' && studyPlan && (
                            <div className="grid md:grid-cols-2 gap-6">
                                {studyPlan.resources.map((resource, i) => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`p-2 rounded-lg ${resource.type.toLowerCase().includes('book') ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                <BookOpen className="w-5 h-5" />
                                            </div>
                                            {resource.url && (
                                                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600">
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-slate-800 mb-2">{resource.title}</h3>
                                        <p className="text-sm text-slate-500 mb-3">{resource.description}</p>
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{resource.type}</span>
                                    </div>
                                ))}
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                                    <GraduationCap className="w-8 h-8 text-blue-500 mb-3" />
                                    <h3 className="font-bold text-blue-900 mb-1">Want more?</h3>
                                    <p className="text-sm text-blue-700">Use the AI Tutor tab to ask for specific articles or videos on any sub-topic.</p>
                                </div>
                            </div>
                        )}

                        {/* CHAT TAB */}
                        {activeTab === 'chat' && (
                            <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-[600px]">
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {chatHistory.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                                            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                                            <p>Ask me anything about your study plan or the topic!</p>
                                        </div>
                                    ) : (
                                        chatHistory.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${msg.role === 'user'
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-bl-none'
                                                    }`}>
                                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-bl-none shadow-sm">
                                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                                <div className="p-4 bg-slate-50 border-t border-slate-200">
                                    <form onSubmit={handleChatSubmit} className="relative">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Ask a question..."
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!chatInput.trim() || chatLoading}
                                            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
