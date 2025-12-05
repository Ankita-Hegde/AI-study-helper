import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { runFullPipeline } from '../services/geminiService';
import { Loader2, Upload, FileVideo, FileText, Youtube } from 'lucide-react';

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
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                <h1 className="text-3xl font-bold mb-6 text-center text-indigo-700">EduAgent Client</h1>
                <p className="text-center text-gray-500 mb-8">Serverless AI Study Companion</p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Youtube className="w-4 h-4 text-red-500" /> YouTube URL
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            placeholder="https://youtube.com/watch?v=..."
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); setFile(null); setError(''); }}
                            disabled={!!file}
                        />
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                            <span className="font-bold">Note:</span> Direct URL analysis is experimental. For best results, please upload the video file.
                        </p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">OR</span>
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer relative"
                        onClick={() => document.getElementById('file-upload')?.click()}>

                        <input
                            id="file-upload"
                            type="file"
                            accept=".pdf,video/mp4,video/webm,video/quicktime"
                            className="hidden"
                            onChange={(e) => { setFile(e.target.files?.[0] || null); setUrl(''); setError(''); }}
                        />

                        {file ? (
                            <div className="flex flex-col items-center">
                                {file.type.startsWith('video') ?
                                    <FileVideo className="w-12 h-12 text-indigo-500 mb-2" /> :
                                    <FileText className="w-12 h-12 text-red-500 mb-2" />
                                }
                                <p className="font-medium text-gray-700">{file.name}</p>
                                <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Upload className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="font-medium text-gray-600">Click to upload PDF or Video</p>
                                <p className="text-xs text-gray-400 mt-1">Supports PDF, MP4, WebM</p>
                            </div>
                        )}
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        onClick={handleGenerate}
                        disabled={loading || (!file && !url)}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Study Materials'}
                    </button>
                </div>
            </div>
        </div>
    );
}
