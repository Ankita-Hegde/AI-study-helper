import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { runFullPipeline } from '../services/geminiService';
import { Loader2, Upload, FileVideo, FileText, Youtube, Sparkles } from 'lucide-react';

export default function Home() {
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
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
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-emerald-50 via-white to-blue-50">
            <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-2xl border border-gray-100">
                {/* Logo and Title */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                        AI Study Helper
                    </h1>
                    <p className="text-gray-500 text-lg">Transform any content into comprehensive study materials</p>
                </div>

                <div className="space-y-6">
                    {/* YouTube URL Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Youtube className="w-5 h-5 text-red-500" />
                            YouTube URL
                        </label>
                        <input
                            type="text"
                            className="w-full border-2 border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-gray-700 placeholder-gray-400"
                            placeholder="https://youtube.com/watch?v=..."
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); setFile(null); setError(''); }}
                            disabled={!!file}
                        />
                        <div className="mt-2 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <span className="font-bold mt-0.5">💡</span>
                            <span>Direct URL analysis is experimental. For best results, please upload the video file.</span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t-2 border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500 font-medium">OR</span>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div
                        className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer relative group"
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
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                                    {file.type.startsWith('video') ?
                                        <FileVideo className="w-8 h-8 text-emerald-600" /> :
                                        <FileText className="w-8 h-8 text-emerald-600" />
                                    }
                                </div>
                                <p className="font-semibold text-gray-800 text-lg mb-1">{file.name}</p>
                                <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
                                >
                                    Remove file
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition">
                                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-emerald-600 transition" />
                                </div>
                                <p className="font-semibold text-gray-700 text-lg mb-2">Click to upload PDF or Video</p>
                                <p className="text-sm text-gray-500">Supports PDF, MP4, WebM, MOV</p>
                                <p className="text-xs text-gray-400 mt-2">Maximum file size: 100MB</p>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                            <span className="font-semibold">⚠️</span>
                            {error}
                        </div>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading || (!file && !url)}
                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span>Generating Study Materials...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-6 h-6" />
                                <span>Generate Study Materials</span>
                            </>
                        )}
                    </button>

                    {/* Features List */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-3 text-center">What you'll get:</p>
                        <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                <span>Comprehensive Notes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                <span>Interactive Flashcards</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                <span>Practice Quizzes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                <span>AI Chat Assistant</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <p className="mt-8 text-sm text-gray-500">
                Powered by AI • Serverless Study Companion
            </p>
        </div>
    );
}
