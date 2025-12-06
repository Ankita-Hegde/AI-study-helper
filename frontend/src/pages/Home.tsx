import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { runFullPipeline } from '../services/geminiService';
import { Loader2, Upload, FileVideo, FileText, Youtube, ArrowLeft, GraduationCap, ArrowRight } from 'lucide-react';

export default function Home() {
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Clean up URL params if any
        if (location.search) {
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const urlParam = params.get('url');
        if (urlParam) {
            setUrl(urlParam);
        }
    }, [location]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    // Remove the Data URL prefix (e.g., "data:application/pdf;base64,")
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('Failed to read file'));
                }
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleGenerate = async () => {
        if (!file && !url) {
            setError('Please upload a PDF/Video or enter a YouTube URL');
            return;
        }

        setLoading(true);
        setError('');

        try {
            let data;
            let mediaUrl = '';
            let mediaType = '';

            if (file) {
                const base64 = await fileToBase64(file);
                data = await runFullPipeline(base64, file.type);
                mediaUrl = URL.createObjectURL(file);
                mediaType = file.type;
            } else if (url) {
                data = await runFullPipeline(url, 'text/plain');
                mediaUrl = url;
                mediaType = 'youtube';
            }
            navigate('/results', { state: { data, mediaUrl, mediaType } });
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to generate materials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center font-sans overflow-hidden">
            {/* Hero Background */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/hero-bg.png"
                    alt="Background"
                    className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-slate-900/40 backdrop-blur-[2px]" />
            </div>

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-5xl px-4 flex flex-col md:flex-row items-center justify-between gap-12">

                {/* Text Section */}
                <div className="text-white md:w-1/2 space-y-6 text-center md:text-left">

                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
                        Master Any <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Subject</span> Instantly
                    </h1>
                    <p className="text-lg text-blue-100/80 max-w-lg mx-auto md:mx-0 leading-relaxed">
                        Upload your study materials or paste a YouTube link.
                        AISH generates structured notes, quizzes, and flashcards in seconds.
                    </p>
                </div>

                {/* Card Section */}
                <div className="md:w-1/2 w-full max-w-md">
                    <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/50 transform transition-all hover:scale-[1.02] duration-300">
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                                <img src="/logo.png" alt="AISH Logo" className="w-12 h-12 object-contain drop-shadow-md" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">Get Started</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="group">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Youtube className="h-5 w-5 text-red-500" />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 p-4 pl-12 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-inner text-slate-700 placeholder:text-slate-400 font-medium"
                                        placeholder="Paste YouTube URL..."
                                        value={url}
                                        onChange={(e) => { setUrl(e.target.value); setFile(null); setError(''); }}
                                        disabled={!!file}
                                    />
                                </div>
                            </div>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-slate-200"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">OR</span>
                                <div className="flex-grow border-t border-slate-200"></div>
                            </div>

                            <div
                                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative group
                                    ${file
                                        ? 'border-blue-500 bg-blue-50/50'
                                        : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                    }`}
                                onClick={() => document.getElementById('file-upload')?.click()}
                            >
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".pdf,video/mp4,video/webm,video/quicktime"
                                    className="hidden"
                                    onChange={(e) => { setFile(e.target.files?.[0] || null); setUrl(''); setError(''); }}
                                />

                                {file ? (
                                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                        {file.type.startsWith('video') ?
                                            <FileVideo className="w-10 h-10 text-blue-600 mb-2" /> :
                                            <FileText className="w-10 h-10 text-red-600 mb-2" />
                                        }
                                        <p className="font-bold text-slate-700 truncate max-w-[200px]">{file.name}</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                            className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Upload className="w-10 h-10 text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" />
                                        <p className="font-bold text-slate-600">Upload File</p>
                                        <p className="text-xs text-slate-400 mt-1">PDF, MP4, WebM</p>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg animate-in slide-in-from-left-2">
                                    <p className="text-red-700 text-sm font-medium">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={loading || (!file && !url)}
                                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Start Learning</span>
                                        <ArrowLeft className="w-5 h-5 rotate-180" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Study Portal Card */}
                    <div
                        onClick={() => navigate('/study-setup')}
                        className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-3xl shadow-xl border border-white/20 cursor-pointer group hover:scale-[1.02] transition-all relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                                    <GraduationCap className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Study Portal</h3>
                                    <p className="text-indigo-100 text-sm">Get a personalized AI study plan</p>
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                <ArrowRight className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
}
