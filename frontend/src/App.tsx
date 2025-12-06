import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import StudySetup from './pages/StudySetup';
import StudyDashboard from './pages/StudyDashboard';
import AishRedirect from './pages/AishRedirect';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/results" element={<Results />} />
                    <Route path="/study-setup" element={<StudySetup />} />
                    <Route path="/study-dashboard" element={<StudyDashboard />} />
                    <Route path="/AISH/*" element={<AishRedirect />} />
                    <Route path="/aish/*" element={<AishRedirect />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
