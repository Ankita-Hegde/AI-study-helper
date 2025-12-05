import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/results" element={<Results />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
