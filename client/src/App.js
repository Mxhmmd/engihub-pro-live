import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Zap, Box, Grid3x3, Gamepad2, User, Settings, Moon, Sun, Download, History, LogOut, Menu, X, Trophy } from 'lucide-react';
import * as math from 'mathjs';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL;

// API Service
const api = {
  async request(endpoint, options = {}) {
    const token = sessionStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    console.log('API Request:', `${API_BASE_URL}${endpoint}`); // Debug log

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    console.log('Response status:', response.status); // Debug log
    console.log('Response OK:', response.ok); // Debug log

    if (!response.ok) {
      const error = await response.json();
      console.log('Error response:', error); // Debug log
      throw new Error(error.error || 'Request failed');
    }

    const data = await response.json();
    console.log('Success response:', data); // Debug log
    return data;
  },

  auth: {
    register: (data) => api.request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => api.request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (email) => api.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token, newPassword) => api.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
    verifyEmail: (token) => api.request(`/auth/verify-email/${token}`),
  },

  user: {
    getProfile: () => api.request('/user/profile'),
    updatePreferences: (preferences) => api.request('/user/preferences', { method: 'PUT', body: JSON.stringify(preferences) }),
  },

  calculations: {
    save: (data) => api.request('/calculations', { method: 'POST', body: JSON.stringify(data) }),
    getHistory: (limit = 10, offset = 0) => api.request(`/calculations/history?limit=${limit}&offset=${offset}`),
    delete: (id) => api.request(`/calculations/${id}`, { method: 'DELETE' }),
  },

  game: {
    saveScore: (score) => api.request('/game/high-score', { method: 'POST', body: JSON.stringify({ score }) }),
    getLeaderboard: (limit = 10) => api.request(`/game/leaderboard?limit=${limit}`),
    getMyBest: () => api.request('/game/my-best'),
  },

  export: {
    historyCSV: () => {
      const token = sessionStorage.getItem('token');
      window.open(`${API_BASE_URL}/export/history/csv?token=${token}`, '_blank');
    },
    historyJSON: () => {
      const token = sessionStorage.getItem('token');
      window.open(`${API_BASE_URL}/export/history/json?token=${token}`, '_blank');
    },
  },
};

const EngineeringApp = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeModule, setActiveModule] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calculationHistory, setCalculationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: ''
  });


  useEffect(() => { 
  const token = sessionStorage.getItem('token');
  if (token) {
    loadUserProfile();
  }
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
}, [loadUserProfile]);


  // ADD THIS NEW CODE HERE:
  useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    window.history.replaceState({}, document.title, window.location.pathname);
    handleEmailVerification(token);
  }
}, [handleEmailVerification]);


  const handleEmailVerification = async (token) => {
    setLoading(true);
    try {
      console.log('Verifying token:', token); // Debug log
      const response = await api.auth.verifyEmail(token);
      console.log('Verification response:', response); // Debug log
      showNotification('Email verified successfully! You can now log in.', 'success');
      // Clear the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setShowAuthModal(true);
      setAuthMode('login');
    } catch (error) {
      console.error('Verification error:', error); // Debug log
      showNotification(`Email verification failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  // END OF NEW CODE


  const loadUserProfile = async () => {
    try {
      const profile = await api.user.getProfile();
      setCurrentUser(profile);
      setIsLoggedIn(true);
      setTheme(profile.theme_preference || 'dark');
      loadCalculationHistory();
    } catch (error) {
      sessionStorage.removeItem('token');
    }
  };

  const loadCalculationHistory = async () => {
    try {
      const { calculations } = await api.calculations.getHistory(10, 0);
      setCalculationHistory(calculations.map(calc => ({
        module: calc.module,
        type: calc.type,
        result: calc.result,
        timestamp: calc.created_at,
        id: calc.id
      })));
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (isLoggedIn) {
      try {
        await api.user.updatePreferences({ theme: newTheme });
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'login') {
        const response = await api.auth.login({
          email: authForm.email,
          password: authForm.password
        });
        sessionStorage.setItem('token', response.token);
        setCurrentUser(response.user);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        showNotification('Login successful!');
        loadCalculationHistory();
      } else if (authMode === 'register') {
        if (authForm.password !== authForm.confirmPassword) {
          showNotification('Passwords do not match!', 'error');
          return;
        }
        await api.auth.register({
          username: authForm.username,
          email: authForm.email,
          password: authForm.password
        });
        showNotification('Registration successful! Please check your email to verify your account.', 'success');
        setAuthMode('login');
      } else if (authMode === 'forgot') {
        await api.auth.forgotPassword(authForm.email);
        showNotification('Password reset link sent to your email!');
        setAuthMode('login');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCalculationHistory([]);
    showNotification('Logged out successfully');
  };

  const saveCalculation = async (calculation) => {
    try {
      await api.calculations.save({
        module: calculation.module,
        type: calculation.type,
        inputs: calculation.inputs,
        result: calculation.result,
        metadata: calculation.metadata || {}
      });
      loadCalculationHistory();
    } catch (error) {
      console.error('Failed to save calculation:', error);
    }
  };

  const addToHistory = (calculation) => {
    setCalculationHistory(prev => [calculation, ...prev].slice(0, 10));
    saveCalculation(calculation);
  };

  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen onShowAuth={() => setShowAuthModal(true)} theme={theme} />
        {showAuthModal && (
          <AuthModal
            mode={authMode}
            setMode={setAuthMode}
            form={authForm}
            setForm={setAuthForm}
            onSubmit={handleAuth}
            onClose={() => setShowAuthModal(false)}
            theme={theme}
            loading={loading}
          />
        )}
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      </>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50`}>
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-2xl font-bold">EngiHub Pro</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSelector theme={theme} onChange={handleThemeChange} />
          <div className="flex items-center gap-2">
            <User size={20} />
            <span className="text-sm hidden md:inline">{currentUser?.username}</span>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-700">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex">
        <Sidebar active={activeModule} onSelect={setActiveModule} theme={theme} isOpen={sidebarOpen} />
        
        <main className="flex-1 p-6 overflow-auto">
          {activeModule === 'dashboard' && <Dashboard theme={theme} user={currentUser} />}
          {activeModule === 'structural' && <StructuralModule theme={theme} onCalculate={addToHistory} />}
          {activeModule === 'linalg' && <LinearAlgebraModule theme={theme} onCalculate={addToHistory} />}
          {activeModule === 'electrical' && <ElectricalModule theme={theme} onCalculate={addToHistory} />}
          {activeModule === 'utilities' && <UtilitiesModule theme={theme} />}
          {activeModule === 'game' && <PongGame theme={theme} onSaveScore={api.game.saveScore} />}
          {activeModule === 'history' && (
            <HistoryView 
              history={calculationHistory} 
              theme={theme} 
              onDelete={async (id) => {
                await api.calculations.delete(id);
                loadCalculationHistory();
              }}
              onExport={api.export}
            />
          )}
        </main>
      </div>

      {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
    </div>
  );
};

const Notification = ({ message, type, onClose }) => {
  const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  
  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-slide-in`}>
      <span>{message}</span>
      <button onClick={onClose} className="hover:bg-white hover:bg-opacity-20 rounded p-1">
        <X size={16} />
      </button>
    </div>
  );
};

const LoginScreen = ({ onShowAuth, theme }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Calculator size={64} className="mx-auto mb-4 text-blue-400" />
          <h1 className="text-4xl font-bold text-white mb-2">EngiHub Pro</h1>
          <p className="text-gray-400">Professional Engineering Toolkit</p>
        </div>
        <div className="space-y-4">
          <button
            onClick={onShowAuth}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
          >
            Get Started
          </button>
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <Box className="mx-auto mb-2 text-blue-400" size={32} />
              <p className="text-xs text-gray-400">Structural</p>
            </div>
            <div className="text-center">
              <Zap className="mx-auto mb-2 text-yellow-400" size={32} />
              <p className="text-xs text-gray-400">Electrical</p>
            </div>
            <div className="text-center">
              <Calculator className="mx-auto mb-2 text-green-400" size={32} />
              <p className="text-xs text-gray-400">Lin. Algebra</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthModal = ({ mode, setMode, form, setForm, onSubmit, onClose, theme, loading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`max-w-md w-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {mode === 'login' ? 'Login' : mode === 'register' ? 'Register' : 'Forgot Password'}
          </h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              required
              minLength={3}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            required
          />
          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              required
              minLength={8}
            />
          )}
          {mode === 'register' && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              required
              minLength={8}
            />
          )}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Login' : mode === 'register' ? 'Register' : 'Send Reset Link'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm space-y-2">
          {mode === 'login' && (
            <>
              <p>
                Don't have an account?{' '}
                <button onClick={() => setMode('register')} className="text-blue-500 hover:underline">
                  Register
                </button>
              </p>
              <button onClick={() => setMode('forgot')} className="text-blue-500 hover:underline">
                Forgot Password?
              </button>
            </>
          )}
          {mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-blue-500 hover:underline">
                Login
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button onClick={() => setMode('login')} className="text-blue-500 hover:underline">
              Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ThemeSelector = ({ theme, onChange }) => {
  return (
    <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => onChange('light')}
        className={`p-2 rounded ${theme === 'light' ? 'bg-blue-600' : ''}`}
        title="Light Mode"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => onChange('dark')}
        className={`p-2 rounded ${theme === 'dark' ? 'bg-blue-600' : ''}`}
        title="Dark Mode"
      >
        <Moon size={16} />
      </button>
    </div>
  );
};

const Sidebar = ({ active, onSelect, theme, isOpen }) => {
  const modules = [
    { id: 'dashboard', name: 'Dashboard', icon: Grid3x3 },
    { id: 'structural', name: 'Structural', icon: Box },
    { id: 'linalg', name: 'Linear Algebra', icon: Calculator },
    { id: 'electrical', name: 'Electrical', icon: Zap },
    { id: 'utilities', name: 'Utilities', icon: Settings },
    { id: 'history', name: 'History', icon: History },
    { id: 'game', name: 'Take a Break', icon: Gamepad2 }
  ];

  return (
    <aside
      className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r w-64 p-4 transition-transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 fixed lg:static h-full z-40`}
    >
      <nav className="space-y-2">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => onSelect(module.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              active === module.id
                ? 'bg-blue-600 text-white'
                : `${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`
            }`}
          >
            <module.icon size={20} />
            <span>{module.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

const Dashboard = ({ theme, user }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const best = await api.game.getMyBest();
        setStats(best);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadStats();
  }, []);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.username}!</h2>
      <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        Member since {new Date(user?.created_at).toLocaleDateString()}
      </p>
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl`}>
            <Trophy className="text-yellow-500 mb-2" size={32} />
            <p className="text-sm text-gray-500">Best Pong Score</p>
            <p className="text-3xl font-bold">{stats.best_score || 0}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl`}>
            <Gamepad2 className="text-blue-500 mb-2" size={32} />
            <p className="text-sm text-gray-500">Games Played</p>
            <p className="text-3xl font-bold">{stats.games_played || 0}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard title="Structural Engineering" description="Calculate beam/column capacities and generate cross-section diagrams" icon={Box} theme={theme} />
        <DashboardCard title="Linear Algebra" description="Matrix operations, eigenvalues, vectors for AI applications" icon={Calculator} theme={theme} />
        <DashboardCard title="Electrical Engineering" description="Ohm's law, reactance, power calculations" icon={Zap} theme={theme} />
        <DashboardCard title="Utilities" description="Unit conversion, equation solver, and more" icon={Settings} theme={theme} />
        <DashboardCard title="Calculation History" description="View and export your calculation history" icon={History} theme={theme} />
        <DashboardCard title="Pong Game" description="Take a break with classic Pong" icon={Gamepad2} theme={theme} />
      </div>
    </div>
  );
};

const DashboardCard = ({ title, description, icon: Icon, theme }) => {
  return (
    <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl shadow-lg hover:shadow-xl transition cursor-pointer`}>
      <Icon size={32} className="mb-4 text-blue-500" />
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{description}</p>
    </div>
  );
};

// Continue with StructuralModule, LinearAlgebraModule, ElectricalModule components...
// (These remain mostly the same but with enhanced features)

const StructuralModule = ({ theme, onCalculate }) => {
  const [calcType, setCalcType] = useState('beam');
  const [inputs, setInputs] = useState({
    width: '',
    height: '',
    reinforcement: '',
    cover: '25',
    load: '',
    span: ''
  });
  const [result, setResult] = useState(null);
  const canvasRef = useRef(null);

  const calculate = () => {
    const w = parseFloat(inputs.width);
    const h = parseFloat(inputs.height);
    const load = parseFloat(inputs.load);
    
    if (isNaN(w) || isNaN(h) || isNaN(load)) {
      alert('Please enter valid numbers');
      return;
    }

    let capacity;
    if (calcType === 'beam') {
      capacity = (w * Math.pow(h, 2) / 6) * 25;
      setResult({ type: 'Bending Moment Capacity', value: capacity.toFixed(2), unit: 'kNm' });
    } else if (calcType === 'column') {
      capacity = w * h * 25;
      setResult({ type: 'Axial Load Capacity', value: capacity.toFixed(2), unit: 'kN' });
    }

    onCalculate({
      module: 'Structural',
      type: calcType,
      inputs: { ...inputs },
      result: `${capacity.toFixed(2)} ${calcType === 'beam' ? 'kNm' : 'kN'}`,
      metadata: { formula: calcType === 'beam' ? 'M = f * b * d² / 6' : 'P = f * A' },
      timestamp: new Date().toISOString()
    });

    drawCrossSection(w, h);
  };

  const drawCrossSection = (w, h) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scale = Math.min(canvas.width / w, canvas.height / h) * 0.7;
    const offsetX = (canvas.width - w * scale) / 2;
    const offsetY = (canvas.height - h * scale) / 2;
    
    ctx.fillStyle = theme === 'dark' ? '#4B5563' : '#D1D5DB';
    ctx.fillRect(offsetX, offsetY, w * scale, h * scale);
    ctx.strokeStyle = theme === 'dark' ? '#9CA3AF' : '#6B7280';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, w * scale, h * scale);
    
    const cover = parseFloat(inputs.cover) || 25;
    const barRadius = 8;
    ctx.fillStyle = '#EF4444';
    
    const corners = [
      [offsetX + cover * scale / 25, offsetY + cover * scale / 25],
      [offsetX + w * scale - cover * scale / 25, offsetY + cover * scale / 25],
      [offsetX + cover * scale / 25, offsetY + h * scale - cover * scale / 25],
      [offsetX + w * scale - cover * scale / 25, offsetY + h * scale - cover * scale / 25]
    ];
    
    corners.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, barRadius, 0, Math.PI * 2);
      ctx.fill();
    });
    
    ctx.fillStyle = theme === 'dark' ? '#FFFFFF' : '#000000';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${w}mm`, offsetX + (w * scale) / 2 - 20, offsetY - 10);
    ctx.fillText(`${h}mm`, offsetX - 40, offsetY + (h * scale) / 2);
  };

  const exportDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `cross-section-${calcType}-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Structural Engineering</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
          <h3 className="text-xl font-bold mb-4">Calculator</h3>
          
          <div className="mb-4">
            <label className="block mb-2">Calculation Type</label>
            <select
              value={calcType}
              onChange={(e) => setCalcType(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            >
              <option value="beam">Beam Bending Capacity</option>
              <option value="column">Column Axial Capacity</option>
              <option value="shear">Shear Capacity</option>
            </select>
          </div>
          
          <div className="space-y-3">
            <input
              type="number"
              placeholder="Width (mm)"
              value={inputs.width}
              onChange={(e) => setInputs({ ...inputs, width: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            />
            <input
              type="number"
              placeholder="Height (mm)"
              value={inputs.height}
              onChange={(e) => setInputs({ ...inputs, height: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            />
            <input
              type="number"
              placeholder="Cover (mm)"
              value={inputs.cover}
              onChange={(e) => setInputs({ ...inputs, cover: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            />
            <input
              type="number"
              placeholder="Applied Load (kN)"
              value={inputs.load}
              onChange={(e) => setInputs({ ...inputs, load: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            />
          </div>
          
          <button
            onClick={calculate}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
          >
            Calculate
          </button>
          
          {result && (
            <div className="mt-6 p-4 bg-green-600 bg-opacity-20 border border-green-600 rounded-lg">
              <p className="font-semibold">{result.type}</p>
              <p className="text-2xl font-bold">{result.value} {result.unit}</p>
            </div>
          )}
        </div>
        
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
          <h3 className="text-xl font-bold mb-4">Cross-Section Diagram</h3>
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="w-full border border-gray-600 rounded-lg"
          />
          <button 
            onClick={exportDiagram}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Export as PNG
          </button>
        </div>
      </div>
    </div>
  );
};

const LinearAlgebraModule = ({ theme, onCalculate }) => {
  const [operation, setOperation] = useState('multiply');
  const [matrixA, setMatrixA] = useState('1,2\n3,4');
  const [matrixB, setMatrixB] = useState('5,6\n7,8');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const parseMatrix = (str) => {
    return str.trim().split('\n').map(row => 
      row.split(',').map(val => parseFloat(val.trim()))
    );
  };

  const calculate = () => {
    setError('');
    setResult('');
    
    try {
      const A = parseMatrix(matrixA);
      const B = operation !== 'determinant' && operation !== 'inverse' ? parseMatrix(matrixB) : null;
      
      let res;
      
      if (operation === 'multiply') {
        res = math.multiply(A, B);
      } else if (operation === 'add') {
        res = math.add(A, B);
      } else if (operation === 'determinant') {
        res = math.det(A);
        setResult(`Determinant = ${res.toFixed(4)}`);
        onCalculate({
          module: 'Linear Algebra',
          operation,
          inputs: { matrixA },
          result: res.toFixed(4),
          timestamp: new Date().toISOString()
        });
        return;
      } else if (operation === 'inverse') {
        res = math.inv(A);
      } else if (operation === 'eigenvalues') {
        const eigs = math.eigs(A);
        setResult(`Eigenvalues:\n${eigs.values.map(v => 
          typeof v === 'object' ? `${v.re.toFixed(4)} + ${v.im.toFixed(4)}i` : v.toFixed(4)
        ).join('\n')}`);
        onCalculate({
          module: 'Linear Algebra',
          operation,
          inputs: { matrixA },
          result: 'Eigenvalues computed',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      if (Array.isArray(res)) {
        setResult(res.map(row => 
          Array.isArray(row) ? row.map(v => v.toFixed(2)).join(', ') : row.toFixed(2)
        ).join('\n'));
      } else {
        setResult(res.toFixed(4));
      }
      
      onCalculate({
        module: 'Linear Algebra',
        operation,
        inputs: { matrixA, matrixB },
        result: 'Matrix result computed',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      setError(e.message || 'Invalid matrix format or operation failed');
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Linear Algebra for AI</h2>
      
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl max-w-4xl`}>
        <div className="mb-4">
          <label className="block mb-2">Operation</label>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <option value="multiply">Matrix Multiplication</option>
            <option value="add">Matrix Addition</option>
            <option value="determinant">Determinant</option>
            <option value="inverse">Matrix Inverse</option>
            <option value="eigenvalues">Eigenvalues</option>
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2">Matrix A (comma-separated rows)</label>
            <textarea
              value={matrixA}
              onChange={(e) => setMatrixA(e.target.value)}
              rows={4}
              className={`w-full px-4 py-2 rounded-lg font-mono ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            />
          </div>
          
          {operation !== 'determinant' && operation !== 'inverse' && operation !== 'eigenvalues' && (
            <div>
              <label className="block mb-2">Matrix B</label>
              <textarea
                value={matrixB}
                onChange={(e) => setMatrixB(e.target.value)}
                rows={4}
                className={`w-full px-4 py-2 rounded-lg font-mono ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
            </div>
          )}
        </div>
        
        <button
          onClick={calculate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
        >
          Calculate
        </button>
        
        {error && (
          <div className="mt-4 p-4 bg-red-600 bg-opacity-20 border border-red-600 rounded-lg">
            <p className="font-semibold">Error: {error}</p>
          </div>
        )}
        
        {result && (
          <div className="mt-4">
            <label className="block mb-2 font-semibold">Result:</label>
            <pre className={`p-4 rounded-lg font-mono ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} whitespace-pre-wrap`}>
              {result}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

const ElectricalModule = ({ theme, onCalculate }) => {
  const [calcType, setCalcType] = useState('ohms');
  const [inputs, setInputs] = useState({ v: '', i: '', r: '', f: '', l: '', c: '' });
  const [result, setResult] = useState(null);

  const calculate = () => {
    let res;
    
    try {
      if (calcType === 'ohms') {
        const v = parseFloat(inputs.v);
        const i = parseFloat(inputs.i);
        const r = parseFloat(inputs.r);
        
        if (!isNaN(v) && !isNaN(i)) {
          res = { label: 'Resistance', value: (v / i).toFixed(4), unit: 'Ω' };
        } else if (!isNaN(v) && !isNaN(r)) {
          res = { label: 'Current', value: (v / r).toFixed(4), unit: 'A' };
        } else if (!isNaN(i) && !isNaN(r)) {
          res = { label: 'Voltage', value: (i * r).toFixed(4), unit: 'V' };
        }
      } else if (calcType === 'power') {
        const v = parseFloat(inputs.v);
        const i = parseFloat(inputs.i);
        const r = parseFloat(inputs.r);
        
        if (!isNaN(v) && !isNaN(i)) {
          res = { label: 'Power', value: (v * i).toFixed(4), unit: 'W' };
        } else if (!isNaN(i) && !isNaN(r)) {
          res = { label: 'Power', value: (i * i * r).toFixed(4), unit: 'W' };
        } else if (!isNaN(v) && !isNaN(r)) {
          res = { label: 'Power', value: (v * v / r).toFixed(4), unit: 'W' };
        }
      } else if (calcType === 'inductive') {
        const f = parseFloat(inputs.f);
        const l = parseFloat(inputs.l);
        if (!isNaN(f) && !isNaN(l)) {
          res = { label: 'Inductive Reactance', value: (2 * Math.PI * f * l).toFixed(4), unit: 'Ω' };
        }
      } else if (calcType === 'capacitive') {
        const f = parseFloat(inputs.f);
        const c = parseFloat(inputs.c);
        if (!isNaN(f) && !isNaN(c) && c !== 0) {
          res = { label: 'Capacitive Reactance', value: (1 / (2 * Math.PI * f * c)).toFixed(4), unit: 'Ω' };
        }
      }
      
      if (res) {
        setResult(res);
        onCalculate({
          module: 'Electrical',
          type: calcType,
          inputs,
          result: `${res.label}: ${res.value} ${res.unit}`,
          timestamp: new Date().toISOString()
        });
      } else {
        alert('Please provide valid inputs for the calculation');
      }
    } catch (e) {
      alert('Calculation error. Please check your inputs.');
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Electrical Engineering</h2>
      
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl max-w-2xl`}>
        <div className="mb-4">
          <label className="block mb-2">Calculation Type</label>
          <select
            value={calcType}
            onChange={(e) => setCalcType(e.target.value)}
            className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
          >
            <option value="ohms">Ohm's Law (V = IR)</option>
            <option value="power">Power Calculations</option>
            <option value="inductive">Inductive Reactance</option>
            <option value="capacitive">Capacitive Reactance</option>
          </select>
        </div>
        
        <div className="space-y-3 mb-4">
          {(calcType === 'ohms' || calcType === 'power') && (
            <>
              <input
                type="number"
                placeholder="Voltage (V)"
                value={inputs.v}
                onChange={(e) => setInputs({ ...inputs, v: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
              <input
                type="number"
                placeholder="Current (A)"
                value={inputs.i}
                onChange={(e) => setInputs({ ...inputs, i: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
              <input
                type="number"
                placeholder="Resistance (Ω)"
                value={inputs.r}
                onChange={(e) => setInputs({ ...inputs, r: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
            </>
          )}
          
          {calcType === 'inductive' && (
            <>
              <input
                type="number"
                placeholder="Frequency (Hz)"
                value={inputs.f}
                onChange={(e) => setInputs({ ...inputs, f: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
              <input
                type="number"
                placeholder="Inductance (H)"
                value={inputs.l}
                onChange={(e) => setInputs({ ...inputs, l: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
            </>
          )}
          
          {calcType === 'capacitive' && (
            <>
              <input
                type="number"
                placeholder="Frequency (Hz)"
                value={inputs.f}
                onChange={(e) => setInputs({ ...inputs, f: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
              <input
                type="number"
                placeholder="Capacitance (F)"
                value={inputs.c}
                onChange={(e) => setInputs({ ...inputs, c: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
              />
            </>
          )}
        </div>
        
        <button
          onClick={calculate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
        >
          Calculate
        </button>
        
        {result && (
          <div className="mt-6 p-4 bg-green-600 bg-opacity-20 border border-green-600 rounded-lg">
            <p className="font-semibold">{result.label}</p>
            <p className="text-2xl font-bold">{result.value} {result.unit}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const UtilitiesModule = ({ theme }) => {
  const [convValue, setConvValue] = useState('');
  const [convFrom, setConvFrom] = useState('N');
  const [convTo, setConvTo] = useState('kN');
  const [convResult, setConvResult] = useState('');

  const conversions = {
    force: { N: 1, kN: 1000, lbf: 4.44822 },
    length: { mm: 1, m: 1000, in: 25.4, ft: 304.8 },
    pressure: { Pa: 1, kPa: 1000, MPa: 1000000, psi: 6894.76 }
  };

  const convert = () => {
    const val = parseFloat(convValue);
    if (isNaN(val)) {
      alert('Please enter a valid number');
      return;
    }
    
    let category = null;
    for (const [cat, units] of Object.entries(conversions)) {
      if (units[convFrom] && units[convTo]) {
        category = cat;
        break;
      }
    }
    
    if (category) {
      const baseValue = val * conversions[category][convFrom];
      const result = baseValue / conversions[category][convTo];
      setConvResult(`${result.toFixed(6)} ${convTo}`);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Utilities</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
          <h3 className="text-xl font-bold mb-4">Unit Conversion</h3>
          
          <input
            type="number"
            placeholder="Enter value"
            value={convValue}
            onChange={(e) => setConvValue(e.target.value)}
            className={`w-full px-4 py-2 rounded-lg mb-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
          />
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <select
              value={convFrom}
              onChange={(e) => setConvFrom(e.target.value)}
              className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            >
              <optgroup label="Force">
                <option value="N">Newton (N)</option>
                <option value="kN">Kilonewton (kN)</option>
                <option value="lbf">Pound-force (lbf)</option>
              </optgroup>
              <optgroup label="Length">
                <option value="mm">Millimeter (mm)</option>
                <option value="m">Meter (m)</option>
                <option value="in">Inch (in)</option>
                <option value="ft">Foot (ft)</option>
              </optgroup>
              <optgroup label="Pressure">
                <option value="Pa">Pascal (Pa)</option>
                <option value="kPa">Kilopascal (kPa)</option>
                <option value="MPa">Megapascal (MPa)</option>
                <option value="psi">PSI</option>
              </optgroup>
            </select>
            
            <select
              value={convTo}
              onChange={(e) => setConvTo(e.target.value)}
              className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}
            >
              <optgroup label="Force">
                <option value="N">Newton (N)</option>
                <option value="kN">Kilonewton (kN)</option>
                <option value="lbf">Pound-force (lbf)</option>
              </optgroup>
              <optgroup label="Length">
                <option value="mm">Millimeter (mm)</option>
                <option value="m">Meter (m)</option>
                <option value="in">Inch (in)</option>
                <option value="ft">Foot (ft)</option>
              </optgroup>
              <optgroup label="Pressure">
                <option value="Pa">Pascal (Pa)</option>
                <option value="kPa">Kilopascal (kPa)</option>
                <option value="MPa">Megapascal (MPa)</option>
                <option value="psi">PSI</option>
              </optgroup>
            </select>
          </div>
          
          <button
            onClick={convert}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-3"
          >
            Convert
          </button>
          
          {convResult && (
            <div className="p-4 bg-green-600 bg-opacity-20 border border-green-600 rounded-lg">
              <p className="text-lg font-bold">{convResult}</p>
            </div>
          )}
        </div>
        
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
          <h3 className="text-xl font-bold mb-4">Quick Reference</h3>
          <div className="space-y-3 text-sm">
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className="font-semibold">Common Force Conversions</p>
              <p>1 kN = 1000 N</p>
              <p>1 lbf ≈ 4.448 N</p>
            </div>
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className="font-semibold">Common Pressure Conversions</p>
              <p>1 MPa = 1000 kPa</p>
              <p>1 psi ≈ 6.895 kPa</p>
            </div>
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className="font-semibold">Common Length Conversions</p>
              <p>1 m = 1000 mm</p>
              <p>1 inch = 25.4 mm</p>
              <p>1 foot = 304.8 mm</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ history, theme, onDelete, onExport }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Calculation History</h2>
        <div className="flex gap-2">
          <button
            onClick={onExport.historyCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Download size={20} />
            Export CSV
          </button>
          <button
            onClick={onExport.historyJSON}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Download size={20} />
            Export JSON
          </button>
        </div>
      </div>
      
      {history.length === 0 ? (
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-8 rounded-xl text-center`}>
          <History size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-gray-500">No calculations yet. Start using the calculators to see your history here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item, idx) => (
            <div key={item.id || idx} className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl flex justify-between items-start`}>
              <div>
                <p className="font-semibold text-lg">{item.module}</p>
                <p className="text-sm text-gray-500">{item.type}</p>
                <p className="mt-2">{item.result}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </p>
              </div>
              {item.id && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PongGame = ({ theme, onSaveScore }) => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const gameStateRef = useRef({
    ball: { x: 400, y: 300, dx: 4, dy: 4, radius: 8 },
    player: { x: 20, y: 250, width: 10, height: 100, dy: 0 },
    ai: { x: 770, y: 250, width: 10, height: 100 }
  });

  useEffect(() => {
  loadLeaderboard();
}, [loadLeaderboard]);


  const loadLeaderboard = async () => {
    try {
      const data = await api.game.getLeaderboard(10);
      setLeaderboard(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  useEffect(() => {
  if (!gameStarted || gameOver) return;

  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationId;

  const gameLoop = () => {
    const state = gameStateRef.current;

    // Background
    ctx.fillStyle = theme === 'dark' ? '#1F2937' : '#F3F4F6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = theme === 'dark' ? '#4B5563' : '#9CA3AF';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ball physics
    state.ball.x += state.ball.dx;
    state.ball.y += state.ball.dy;

    if (state.ball.y - state.ball.radius < 0 || state.ball.y + state.ball.radius > canvas.height) {
      state.ball.dy *= -1;
    }

    // Collision with player and AI
    // ... (your collision logic)

    // Draw paddles and ball
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(state.ai.x, state.ai.y, state.ai.width, state.ai.height);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    animationId = requestAnimationFrame(gameLoop);
  };

  // Start the loop
  gameLoop();

  return () => cancelAnimationFrame(animationId);
}, [gameStarted, gameOver, theme]);


  const handleKeyDown = (e) => {
    const state = gameStateRef.current;
    if (e.key === 'ArrowUp') state.player.dy = -6;
    if (e.key === 'ArrowDown') state.player.dy = 6;
  };

  const handleKeyUp = (e) => {
    const state = gameStateRef.current;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') state.player.dy = 0;
  };


useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, [handleKeyDown, handleKeyUp]);


  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setScore({ player: 0, ai: 0 });
    gameStateRef.current = {
      ball: { x: 400, y: 300, dx: 4, dy: 4, radius: 8 },
      player: { x: 20, y: 250, width: 10, height: 100, dy: 0 },
      ai: { x: 770, y: 250, width: 10, height: 100 }
    };
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Pong - Take a Break!</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-2xl font-bold">You: {score.player}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">AI: {score.ai}</p>
              </div>
            </div>
            
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full border-4 border-gray-600 rounded-lg"
            />
            
            <div className="mt-4 text-center">
              {!gameStarted && !gameOver ? (
                <button
                  onClick={() => setGameStarted(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition"
                >
                  Start Game
                </button>
              ) : gameOver ? (
                <div>
                  <p className="text-2xl font-bold mb-4">
                    {score.player >= 10 ? '🎉 You Win!' : '😔 AI Wins!'}
                  </p>
                  <button
                    onClick={resetGame}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition"
                  >
                    Play Again
                  </button>
                </div>
              ) : (
                <button
                  onClick={resetGame}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition"
                >
                  Reset Game
                </button>
              )}
              <p className="mt-4 text-sm text-gray-500">Use Arrow Up/Down keys to control your paddle</p>
              <p className="text-sm text-gray-500">First to 10 points wins!</p>
            </div>
          </div>
        </div>
        
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500" />
            Leaderboard
          </h3>
          {leaderboard.length === 0 ? (
            <p className="text-gray-500 text-sm">No scores yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between items-center p-3 rounded-lg ${
                    idx === 0 ? 'bg-yellow-600 bg-opacity-20 border border-yellow-600' :
                    idx === 1 ? 'bg-gray-600 bg-opacity-20 border border-gray-600' :
                    idx === 2 ? 'bg-orange-600 bg-opacity-20 border border-orange-600' :
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">{idx + 1}</span>
                    <span>{entry.username}</span>
                  </div>
                  <span className="font-bold">{entry.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EngineeringApp;
