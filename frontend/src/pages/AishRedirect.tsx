import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { runFullPipeline } from '../services/geminiService';
import { Loader2 } from 'lucide-react';

export default function AishRedirect() {
    const location = useLocation();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const doRedirect = async () => {
            try {
                // Determine source: look for '/aish/' or '/AISH/' anywhere in the href/path
                let urlCandidate: string | null = null;
                const href = window.location.href || '';

                // Search for '/aish/' segment anywhere (case-insensitive)
                const match = href.match(/\/aish\/(.*)$/i);
                if (match && match[1]) {
                    urlCandidate = match[1];
                }

                // If not found, also check pathname/search/hash combination
                if (!urlCandidate) {
                    const path = (location.pathname || '') + (location.search || '') + (location.hash || '');
                    const m2 = path.match(/\/aish\/(.*)$/i);
                    if (m2 && m2[1]) urlCandidate = m2[1];
                }

                // Host-based: if hostname is 'aish', use pathname after leading '/'
                const hostname = (location.hostname || '').toLowerCase();
                if (!urlCandidate && hostname === 'aish') {
                    const p = (location.pathname || '') + (location.search || '') + (location.hash || '');
                    if (p.startsWith('/')) urlCandidate = p.slice(1);
                }

                if (!urlCandidate) {
                    // Nothing matched: go home
                    navigate('/');
                    return;
                }

                // decodeURIComponent if needed
                try { urlCandidate = decodeURIComponent(urlCandidate); } catch (e) { /* ignore */ }

                // Strip accidental leading 'AISH/' if present (e.g., double-encoded)
                if (urlCandidate.toUpperCase().startsWith('AISH/')) urlCandidate = urlCandidate.slice(5);

                // If the url is missing scheme and begins with www., prepend https://
                if (!/^https?:\/\//i.test(urlCandidate) && urlCandidate.startsWith('www.')) {
                    urlCandidate = 'https://' + urlCandidate;
                }

                    // Try to process here and navigate directly to results so users land on the dashboard.
                    try {
                        const data = await runFullPipeline(urlCandidate, 'application/url');
                        navigate('/results', { state: { data, mediaUrl: urlCandidate, mediaType: 'youtube' } });
                        return;
                    } catch (e) {
                        // If direct processing fails, fall back to the Home auto-run flow to reuse its handling.
                        console.warn('Direct AISH processing failed, falling back to Home auto-run', e);
                        navigate('/', { state: { autoRun: true, url: urlCandidate } });
                        return;
                    }
            } catch (e: any) {
                console.error('AISH redirect failed', e);
                setError(e?.message || 'Failed to process AISH link');
            }
        };
        doRedirect();
    }, [location, navigate]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-red-600 mb-4">{error}</p>
                    <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-900 text-white rounded">Go Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center text-slate-600">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-indigo-600" />
                <div>Processing AISH link and generating study materials...</div>
            </div>
        </div>
    );
}
