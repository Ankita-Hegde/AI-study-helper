import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, GraduationCap, Globe, Cpu, Palette, FlaskConical, MoreHorizontal } from 'lucide-react';

const AREAS = [
    { id: 'tech', name: 'Technology', icon: Cpu, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'science', name: 'Science', icon: FlaskConical, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'language', name: 'Language', icon: Globe, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { id: 'arts', name: 'Arts', icon: Palette, color: 'text-pink-500', bg: 'bg-pink-50' },
    { id: 'other', name: 'Other', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-50' },
];

const EDUCATION_LEVELS = [
    'High School',
    'Undergraduate',
    'Postgraduate',
    'PhD',
    'Self-Taught'
];

const PROFICIENCY_LEVELS = [
    'Beginner',
    'Intermediate',
    'Advanced',
    'Expert'
];

export default function StudySetup() {
    const navigate = useNavigate();
    const [area, setArea] = useState('');
    const [topic, setTopic] = useState('');
    const [level, setLevel] = useState('');

    const isAcademic = area === 'tech' || area === 'science';
    const currentLevels = isAcademic ? EDUCATION_LEVELS : PROFICIENCY_LEVELS;
    const levelLabel = isAcademic ? 'Education Level' : 'Proficiency Level';

    // Reset level when area changes type
    const handleAreaChange = (newArea: string) => {
        setArea(newArea);
        setLevel(''); // Force re-selection to avoid invalid states
    };

    const handleStart = () => {
        if (!area || !topic) return;

        const profile = {
            area: AREAS.find(a => a.id === area)?.name,
            topic,
            level
        };

        localStorage.setItem('user_study_profile', JSON.stringify(profile));
        navigate('/study-dashboard');
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

            <div className="relative z-10 bg-white max-w-2xl w-full rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row m-4">

                {/* Left Side - Visual */}
                <div className="md:w-2/5 bg-gradient-to-br from-blue-600 to-cyan-600 p-8 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-6">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Study Anything</h2>
                        <p className="text-blue-100 opacity-90">Get a personalized AI study plan for any topic you want to master.</p>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute top-10 -left-10 w-20 h-20 bg-cyan-400/20 rounded-full blur-xl"></div>
                </div>

                {/* Right Side - Form */}
                <div className="md:w-3/5 p-8 md:p-12">
                    <h3 className="text-2xl font-bold text-slate-800 mb-8">Create Study Plan</h3>

                    <div className="space-y-6">
                        {/* Area Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">Area of Study</label>
                            <div className="grid grid-cols-2 gap-2">
                                {AREAS.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => handleAreaChange(a.id)}
                                        className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all text-left
                                            ${area === a.id
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                            }`}
                                    >
                                        <a.icon className={`w-4 h-4 ${a.color}`} />
                                        <span className="font-medium">{a.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Specific Topic */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">Specific Topic</label>
                            <div className="relative">
                                <BookOpen className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. Quantum Physics, French History..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-800 placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* Level */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">{levelLabel}</label>
                            <div className="flex flex-wrap gap-2">
                                {currentLevels.map(l => (
                                    <button
                                        key={l}
                                        onClick={() => setLevel(l)}
                                        className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all
                                            ${level === l
                                                ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleStart}
                        disabled={!area || !topic || !level}
                        className="w-full mt-8 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-bold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <span>Start Studying</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
