import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  File, 
  Download, 
  Search, 
  HardDrive, 
  Share2, 
  CheckCircle2, 
  AlertCircle, 
  Home, 
  Heart, 
  MessageCircle,
  FolderOpen,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Lock,
  Cloud,
  Zap,
  Menu,
  RefreshCw,
  X,
  Trash2,
  Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileMetadata {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadDate: number;
  type: 'file' | 'folder';
  parentId: string | null;
}

export default function App() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [view, setView] = useState<'home' | 'download' | 'login'>('home');
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminPassword, setAdminPassword] = useState(localStorage.getItem('admin_pass') || '');
  const [loginInput, setLoginInput] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<FileMetadata[]>([]);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [uploadingBg, setUploadingBg] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeItemMenu, setActiveItemMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.backgroundImage) {
        setBackgroundImage(data.backgroundImage);
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setShowAdminMenu(false);
      }
      // Also close active item menu if clicking outside
      if (activeItemMenu && !(event.target as HTMLElement).closest('.item-menu-container')) {
        setActiveItemMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeItemMenu]);

  useEffect(() => {
    if (adminPassword) {
      verifyAdmin(adminPassword);
    }
    
    // Check for direct download link
    const handleUrl = () => {
      const path = window.location.pathname;
      if (path.startsWith('/d/')) {
        const fileId = path.split('/d/')[1];
        fetchFile(fileId);
      } else if (path === '/admin') {
        setView(isLoggedIn ? 'home' : 'login');
      } else {
        setView('home');
      }
    };

    handleUrl();
    window.addEventListener('popstate', handleUrl);
    return () => window.removeEventListener('popstate', handleUrl);
  }, [isLoggedIn]);

  const verifyAdmin = async (pass: string) => {
    const trimmedPass = (pass || '').toString().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!trimmedPass) return;
    setIsLoggingIn(true);
    setLoginError(false);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmedPass }),
      });
      if (res.ok) {
        setIsLoggedIn(true);
        setAdminPassword(pass);
        localStorage.setItem('admin_pass', pass);
        if (window.location.pathname === '/admin') {
          window.history.pushState({}, '', '/');
          setView('home');
        } else {
          setView('home');
        }
      } else {
        localStorage.removeItem('admin_pass');
        setAdminPassword('');
        setIsLoggedIn(false);
        if (view === 'login') setLoginError(true);
      }
    } catch (err) {
      console.error('Verify failed', err);
      if (view === 'login') setLoginError(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    verifyAdmin(loginInput);
  };

  const fetchFiles = async (parentId: string | null = currentFolderId) => {
    try {
      const url = parentId ? `/api/files?parentId=${parentId}` : '/api/files';
      const res = await fetch(url);
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error('Failed to fetch files', err);
    }
  };

  const fetchFile = async (id: string) => {
    try {
      const res = await fetch(`/api/file/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedFile(data);
        setView('download');
      } else {
        setView('home');
        window.history.pushState({}, '', '/');
      }
    } catch (err) {
      console.error('Failed to fetch file', err);
      setView('home');
    }
  };

  const handleFolderCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('folderName') as string;
    if (!name) return;

    try {
      const res = await fetch('/api/create-folder', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ name, parentId: currentFolderId }),
      });
      if (res.ok) {
        setShowFolderInput(false);
        fetchFiles();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create folder');
      }
    } catch (err) {
      console.error('Failed to create folder', err);
    }
  };

  const enterFolder = (folder: FileMetadata) => {
    setFolderStack([...folderStack, folder]);
    setCurrentFolderId(folder.id);
  };

  const goBack = () => {
    const newStack = [...folderStack];
    newStack.pop();
    const parent = newStack[newStack.length - 1];
    setFolderStack(newStack);
    setCurrentFolderId(parent ? parent.id : null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (!isLoggedIn) {
      alert('Only admin can upload files!');
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    
    const formData = new FormData();
    formData.append('file', file);
    if (currentFolderId) {
      formData.append('parentId', currentFolderId);
    }

    try {
      const interval = setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 5 : prev));
      }, 200);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
        body: formData,
      });
      
      clearInterval(interval);
      setUploadProgress(100);

      if (res.ok) {
        setUploading(false);
        setUploadProgress(0);
        fetchFiles();
      } else {
        const err = await res.json();
        alert(err.error || 'Upload failed');
        setUploading(false);
      }
    } catch (err) {
      console.error('Upload failed', err);
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/d/${id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const uploadBackground = async (file: File) => {
    if (!isLoggedIn) return;
    setUploadingBg(true);
    const formData = new FormData();
    formData.append('background', file);

    try {
      const res = await fetch('/api/settings/background', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setBackgroundImage(data.url);
      } else {
        alert('Failed to upload background');
      }
    } catch (err) {
      console.error('Failed to upload background', err);
    } finally {
      setUploadingBg(false);
    }
  };

  const resetBackground = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch('/api/settings/reset-background', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
      });
      if (res.ok) {
        setBackgroundImage('');
      }
    } catch (err) {
      console.error('Failed to reset background', err);
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (!isLoggedIn) return;
    if (!confirm(`Are you sure you want to delete "${name}"? If it's a folder, everything inside will be deleted.`)) return;

    try {
      const res = await fetch(`/api/delete/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword },
      });
      if (res.ok) {
        if (view === 'download') {
          navigateToHome();
        } else {
          fetchFiles();
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Delete failed');
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const navigateToHome = () => {
    setView('home');
    setCurrentFolderId(null);
    setFolderStack([]);
    window.history.pushState({}, '', '/');
    fetchFiles(null);
  };

  useEffect(() => {
    fetchFiles();
  }, [currentFolderId]);

  const filteredFiles = files.filter(f => 
    f.originalName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`min-h-screen transition-colors duration-500 ${backgroundImage ? 'bg-slate-900/10' : 'bg-slate-50'} text-slate-900 font-sans selection:bg-red-100 selection:text-red-900 overflow-x-hidden relative`}>
      {/* Background Layer */}
      <AnimatePresence>
        {backgroundImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-0 pointer-events-none"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Floating Blurry Tablet */}
      <header className="sticky top-4 z-50 px-4 mb-6">
        <div className={`max-w-6xl mx-auto h-14 px-4 flex items-center justify-between rounded-2xl border transition-all duration-500 ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.05)]' : 'bg-white/90 backdrop-blur-md border-slate-200 shadow-lg shadow-slate-200/40'}`}>
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={navigateToHome}
          >
            <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-all duration-300 overflow-hidden ${backgroundImage ? 'bg-slate-900/30 backdrop-blur-md border border-white/10' : 'bg-linear-to-br from-slate-800 to-slate-900'}`}>
              <Cloud className="w-4 h-4 text-slate-100 opacity-40 group-hover:opacity-60 transition-opacity" />
              <Zap className="absolute inset-0 m-auto w-4 h-4 text-red-500 fill-red-500 group-hover:scale-110 transition-all drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            </div>
            <span className={`text-base font-black tracking-tighter group-hover:text-red-600 transition-colors uppercase ${backgroundImage ? 'text-slate-900' : 'text-slate-800'}`}>Tempesta <span className={backgroundImage ? 'text-slate-800/60 font-bold' : 'text-slate-400 font-medium'}>Cloudy</span></span>
          </div>
          
          <div className="flex items-center gap-3 md:gap-5">
            <nav className={`hidden md:flex items-center gap-5 text-[10px] font-black uppercase tracking-widest ${backgroundImage ? 'text-slate-900' : 'text-slate-600'}`}>
              <button onClick={navigateToHome} className="hover:text-red-600 transition-colors flex items-center gap-2"><Home className="w-3.5 h-3.5"/> Beranda</button>
              <a href="https://saweria.co/Kaedesu" target="_blank" className="hover:text-pink-600 transition-colors flex items-center gap-2"><Heart className="w-3.5 h-3.5"/> Donate</a>
            </nav>
            <div className={`h-5 w-px hidden md:block ${backgroundImage ? 'bg-slate-900/10' : 'bg-slate-200'}`} />
            
            {/* Mobile Menu Toggle */}
            <button 
              className={`md:hidden p-2 rounded-xl transition-all active:scale-95 ${backgroundImage ? 'bg-slate-900/10 text-slate-900 border border-white/10' : 'text-slate-600 hover:bg-slate-100 bg-slate-50'}`}
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            {isLoggedIn ? (
              <div className="relative" ref={adminMenuRef}>
                <button 
                  onClick={() => setShowAdminMenu(!showAdminMenu)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shadow-sm ${backgroundImage ? 'bg-white/20 backdrop-blur-md text-slate-900 border-white/20 hover:bg-white/30' : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'}`}
                >
                   <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${backgroundImage ? 'bg-slate-900' : 'bg-red-500'}`} />
                   Admin
                </button>
                
                <AnimatePresence>
                  {showAdminMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className={`absolute right-0 mt-2 w-48 border rounded-xl shadow-2xl p-1 z-[60] overflow-hidden transition-all ${backgroundImage ? 'bg-white/40 backdrop-blur-2xl border-white/30' : 'bg-white border-slate-200'}`}
                    >
                      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50/10 mb-1">
                        Display Settings
                      </div>
                      <button 
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowAdminMenu(false);
                          bgInputRef.current?.click();
                        }}
                      >
                        <Upload className="w-3.5 h-3.5 text-red-500" />
                        {uploadingBg ? 'Changing...' : 'Themes Background'}
                      </button>
                      
                      {backgroundImage && (
                        <button 
                          className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50/20 rounded-lg transition-colors flex items-center gap-2"
                          onClick={() => {
                            setShowAdminMenu(false);
                            resetBackground();
                          }}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Clear Background
                        </button>
                      )}
                      
                      <div className="h-px bg-slate-100/10 my-1" />
                      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50/10 mb-1">
                        System
                      </div>
                      
                      <button 
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-500/10 rounded-lg transition-colors flex items-center gap-2"
                        onClick={() => {
                          setAdminPassword('');
                          localStorage.removeItem('admin_pass');
                          setIsLoggedIn(false);
                          setShowAdminMenu(false);
                        }}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Logout Admin
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="hidden sm:inline-block text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded uppercase tracking-[0.1em]">Guest</span>
                <button 
                  onClick={() => setView('login')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Login
                </button>
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp"
              ref={bgInputRef} 
              className="hidden" 
              onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])} 
            />
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showMobileMenu && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`md:hidden border-b overflow-hidden z-40 relative transition-all duration-300 ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20' : 'bg-white border-slate-200'}`}
          >
            <div className="px-4 py-4 space-y-4">
              <button 
                onClick={() => { navigateToHome(); setShowMobileMenu(false); }} 
                className={`w-full text-left font-bold flex items-center gap-3 p-3 rounded-xl transition-all ${backgroundImage ? 'text-slate-900 hover:bg-white/20' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <Home className="w-5 h-5 text-red-500" /> Beranda
              </button>
              <a 
                href="https://saweria.co/Kaedesu" 
                target="_blank" 
                className={`block w-full text-left font-bold flex items-center gap-3 p-3 rounded-xl transition-all ${backgroundImage ? 'text-slate-900 hover:bg-white/20' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setShowMobileMenu(false)}
              >
                <Heart className="w-5 h-5 text-pink-500" /> Support/Donate
              </a>
              {!isLoggedIn && (
                <button 
                  onClick={() => { setView('login'); setShowMobileMenu(false); }} 
                  className={`w-full text-left font-bold flex items-center gap-3 p-3 rounded-xl transition-all ${backgroundImage ? 'text-slate-900 hover:bg-white/20' : 'text-red-600 hover:bg-red-50'}`}
                >
                  <Lock className="w-5 h-5" /> Login Admin
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {view === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-sm mx-auto pt-20"
              >
                <div className={`p-8 rounded-2xl border shadow-xl transition-all duration-500 ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20' : 'bg-white border-slate-200'}`}>
                  <div className="text-center mb-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 border transition-all ${backgroundImage ? 'bg-slate-900/10 border-white/10 text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      <Lock className="w-6 h-6" />
                    </div>
                    <h2 className={`text-xl font-black uppercase tracking-tight ${backgroundImage ? 'text-slate-900' : 'text-slate-800'}`}>Admin Login</h2>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${backgroundImage ? 'text-slate-900/60' : 'text-slate-400'}`}>Authorization Protocol</p>
                    {loginError && (
                      <motion.p 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-4 bg-red-500/10 py-2 rounded-xl border border-red-500/20 shadow-sm"
                      >
                        Access Denied: Invalid Key
                      </motion.p>
                    )}
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <input 
                      name="password"
                      type="password"
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      disabled={isLoggingIn}
                      placeholder="Access Key" 
                      className={`w-full px-4 py-3 border rounded-xl outline-none transition-all text-sm font-bold ${backgroundImage ? 'bg-white/20 border-white/30 focus:bg-white/40 focus:border-red-500 text-slate-900 placeholder-slate-700' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-50'} ${loginError ? 'border-red-500/50' : ''}`}
                      autoFocus
                    />
                    <button 
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-[0.98] text-xs shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoggingIn ? 'Authenticating...' : 'Verify'}
                    </button>
                    <button 
                      type="button"
                      onClick={navigateToHome}
                      className={`w-full py-2 font-black text-[10px] uppercase tracking-[0.2em] transition-colors ${backgroundImage ? 'text-slate-900/60 hover:text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              </motion.div>
          ) : view === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Support Banner - ItsNoMercy style */}
              <div className={`rounded-2xl p-6 text-white relative overflow-hidden group transition-all duration-500 border ${backgroundImage ? 'bg-red-600/40 backdrop-blur-xl border-red-400/20 shadow-lg shadow-red-900/10' : 'bg-red-600 border-red-700'}`}>
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                    <Heart className="w-24 h-24" />
                 </div>
                 <div className="relative z-10 space-y-2">
                    <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">SUPPORT US! 🔥</h2>
                    <p className={`text-sm max-w-lg font-bold ${backgroundImage ? 'text-white' : 'text-red-100'}`}>Support kami agar bisa terus melakukan update setiap hari dan tetap menyediakan layanan gratis!</p>
                    <div className="flex gap-3 pt-3">
                       <a href="https://saweria.co/Kaedesu" target="_blank" className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${backgroundImage ? 'bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/20' : 'bg-white text-red-600 hover:bg-red-50'}`}>Saweria</a>
                    </div>
                 </div>
              </div>

              {/* Breadcrumbs & Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-2xl border shadow-sm grow transition-all duration-500 ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20' : 'bg-white border-slate-200 text-slate-500'}`}>
                  <FolderOpen className="w-4 h-4 text-red-500" />
                  <span className={`hover:text-red-600 cursor-pointer ${backgroundImage ? 'text-slate-900/60' : ''}`} onClick={navigateToHome}>Listed App</span>
                  {folderStack.map((folder, i) => (
                    <React.Fragment key={folder.id}>
                      <ChevronRight className={`w-4 h-4 ${backgroundImage ? 'text-slate-400' : 'text-slate-300'}`} />
                      <span 
                        className={`cursor-pointer hover:text-red-600 transition-colors ${i === folderStack.length - 1 ? (backgroundImage ? 'text-slate-900 font-black' : 'text-slate-900 font-bold') : (backgroundImage ? 'text-slate-900/60' : '')}`}
                        onClick={() => {
                          const newStack = folderStack.slice(0, i + 1);
                          setFolderStack(newStack);
                          setCurrentFolderId(folder.id);
                        }}
                      >
                        {folder.originalName}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {folderStack.length > 0 && (
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={goBack}
                      className={`p-2.5 rounded-2xl transition-all duration-300 shadow-sm flex items-center justify-center border ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20 text-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                      title="Go Back"
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </motion.button>
                  )}
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fetchFiles()}
                    className={`p-2.5 rounded-2xl transition-all duration-300 shadow-sm flex items-center justify-center border ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20 text-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                    title="Refresh"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </motion.button>
                  <div className="relative group">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-2.5 rounded-2xl transition-all duration-300 shadow-sm flex items-center justify-center border ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20 text-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                      title="More Options"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </motion.button>
                    <div className={`absolute right-0 top-full mt-2 w-44 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] transform origin-top-right scale-95 group-hover:scale-100 p-1 border ${backgroundImage ? 'bg-white/40 backdrop-blur-2xl border-white/30' : 'bg-white border-slate-200'}`}>
                       <button className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2 ${backgroundImage ? 'text-slate-900' : 'text-slate-600'}`} onClick={() => fetchFiles()}>
                          <RefreshCw className="w-3.5 h-3.5 text-red-500" />
                          Force Sync
                       </button>
                       <button className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2 ${backgroundImage ? 'text-slate-900' : 'text-slate-600'}`} onClick={navigateToHome}>
                          <Home className="w-3.5 h-3.5 text-red-500" />
                          Terminal Home
                       </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Container */}
              <div className={`rounded-2xl shadow-xl overflow-hidden min-h-[400px] transition-all duration-500 relative z-10 border ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20' : 'bg-white border-slate-200'}`}>
                {/* Control Bar */}
                <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${backgroundImage ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="relative flex-1 max-w-md">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${backgroundImage ? 'text-slate-700' : 'text-slate-400'}`} />
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search files..." 
                      className={`pl-10 pr-4 py-2 border rounded-xl text-sm w-full outline-none transition-all font-bold ${backgroundImage ? 'bg-white/10 border-white/20 text-slate-900 placeholder-slate-700 focus:bg-white/20 focus:border-red-500/50' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-red-500/10 focus:border-red-500'}`}
                    />
                  </div>
                  
                  {isLoggedIn && (
                    <div className="flex items-center gap-2">
                      <button 
                         onClick={() => setShowFolderInput(!showFolderInput)}
                         className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${backgroundImage ? 'bg-white/20 hover:bg-white/30 border border-white/20 text-slate-900' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}
                      >
                         <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                         Directory
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-600/20"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {uploading ? `${uploadProgress}%` : 'Upload'}
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                </div>

                {showFolderInput && (
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <form onSubmit={handleFolderCreate} className="flex gap-2">
                       <input 
                        name="folderName"
                        type="text"
                        placeholder="Folder Name"
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
                        autoFocus
                       />
                       <button type="submit" className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Create</button>
                       <button type="button" onClick={() => setShowFolderInput(false)} className="px-4 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                    </form>
                  </div>
                )}

                {/* File List Header */}
                <div className={`grid grid-cols-[1fr_80px_120px_40px] px-6 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${backgroundImage ? 'bg-white/30 text-slate-600 border-white/10' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                   <span>Name</span>
                   <span className="text-center">Size</span>
                   <span className="text-right">Date</span>
                   <span></span>
                </div>

                {/* List Content */}
                <div className={`divide-y ${backgroundImage ? 'divide-white/5' : 'divide-slate-50'}`}>
                  {filteredFiles.map((file) => (
                    <div 
                      key={file.id}
                      className={`grid grid-cols-[1fr_80px_120px_40px] items-center px-6 py-3.5 transition-colors group cursor-pointer ${backgroundImage ? 'hover:bg-white/40' : 'hover:bg-slate-50'}`}
                      onClick={() => file.type === 'folder' ? enterFolder(file) : fetchFile(file.id)}
                    >
                       <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${file.type === 'folder' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'}`}>
                             {file.type === 'folder' ? <FolderOpen className="w-4 h-4" /> : <File className="w-4 h-4" />}
                          </div>
                          <span className="text-sm font-medium truncate text-slate-700 group-hover:text-red-600 transition-colors">{file.originalName}</span>
                       </div>
                       <span className="text-center text-xs text-slate-500 font-medium">{file.type === 'folder' ? '-' : formatSize(file.size)}</span>
                       <span className="text-right text-xs text-slate-400 font-medium">{new Date(file.uploadDate).toLocaleDateString()}</span>
                       <div className="flex justify-end gap-2 item-menu-container relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveItemMenu(activeItemMenu === file.id ? null : file.id);
                            }}
                            className={`p-1.5 rounded-lg transition-all ${activeItemMenu === file.id ? 'bg-red-500/10 text-red-500' : 'text-slate-300 hover:text-red-500 hover:bg-red-500/5'}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          <AnimatePresence>
                            {activeItemMenu === file.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 5 }}
                                className={`absolute right-0 top-full mt-1 w-36 rounded-xl shadow-xl z-50 p-1 border overflow-hidden ${backgroundImage ? 'bg-white/40 backdrop-blur-2xl border-white/30' : 'bg-white border-slate-200'}`}
                              >
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyLink(file.id);
                                    setActiveItemMenu(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-500/10 rounded-lg transition-colors flex items-center gap-2"
                                >
                                  <Share2 className="w-3 h-3 text-red-500" />
                                  Copy Link
                                </button>
                                
                                {isLoggedIn && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteItem(file.id, file.originalName);
                                      setActiveItemMenu(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </button>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                       </div>
                    </div>
                  ))}
                  {filteredFiles.length === 0 && !uploading && (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-300 space-y-3">
                       <FolderOpen className="w-12 h-12 opacity-20" />
                       <p className="text-sm font-medium">Directory is empty or no matches found.</p>
                    </div>
                  )}
                  {uploading && (
                    <div className="p-10 flex flex-col items-center justify-center space-y-4">
                       <div className="w-full max-w-xs h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            className="bg-red-600 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                          />
                       </div>
                       <p className="text-[10px] font-black uppercase text-red-600 tracking-widest animate-pulse">Streaming to cloud node...</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="download"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className={`rounded-2xl shadow-2xl overflow-hidden relative z-10 border transition-all duration-500 ${backgroundImage ? 'bg-white/20 backdrop-blur-2xl border-white/20' : 'bg-white border-slate-200'}`}>
                <div className="h-2 bg-red-600" />
                <div className="p-8 md:p-12 text-center space-y-8">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto transition-all border shadow-inner ${backgroundImage ? 'bg-slate-900/10 border-white/10 text-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    <File className="w-10 h-10" />
                  </div>
                  
                  <div className="space-y-4">
                    <h1 className={`text-2xl font-black tracking-tighter uppercase ${backgroundImage ? 'text-slate-900' : 'text-slate-800'}`}>{selectedFile?.originalName}</h1>
                    <div className={`flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-widest ${backgroundImage ? 'text-slate-900/60' : 'text-slate-400'}`}>
                      <span>{formatSize(selectedFile?.size || 0)}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${backgroundImage ? 'bg-slate-900/20' : 'bg-slate-200'}`} />
                      <span>Ready for Transmission</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 max-w-sm mx-auto">
                    <a 
                      href={`/download/${selectedFile?.id}`}
                      className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-xl shadow-red-600/30 active:scale-95 text-xs"
                    >
                      <Download className="w-5 h-5" />
                      Begin Pipeline
                    </a>
                    <button 
                      onClick={() => selectedFile && copyLink(selectedFile.id)}
                      className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all border text-xs ${backgroundImage ? 'bg-white/20 border-white/30 text-slate-900 hover:bg-white/30 shadow-lg shadow-black/5' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <Share2 className="w-4 h-4" />
                      Copy Origin URL
                    </button>
                    {isLoggedIn && selectedFile && (
                      <button 
                        onClick={() => deleteItem(selectedFile.id, selectedFile.originalName)}
                        className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-red-200 hover:bg-red-200 text-xs mt-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Permanently
                      </button>
                    )}
                    <button 
                      onClick={navigateToHome}
                      className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors py-2 ${backgroundImage ? 'text-slate-900/40 hover:text-slate-900' : 'text-slate-400 hover:text-slate-900'}`}
                    >
                      Back to Matrix
                    </button>
                  </div>

                  <div className={`pt-8 border-t flex items-center justify-center gap-8 grayscale opacity-50 ${backgroundImage ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className="flex flex-col items-center gap-2">
                       <CheckCircle2 className="w-5 h-5" />
                       <span className="text-[8px] font-black uppercase">Identity Verified</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                       <AlertCircle className="w-5 h-5" />
                       <span className="text-[8px] font-black uppercase">Encrypted Path</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                       <ExternalLink className="w-5 h-5" />
                       <span className="text-[8px] font-black uppercase">Low Latency</span>
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className={`max-w-6xl mx-auto px-4 py-12 border-t mt-12 mb-8 transition-all ${backgroundImage ? 'border-white/10' : 'border-slate-200'}`}>
        <div className={`flex flex-col md:flex-row items-center justify-between gap-6 ${backgroundImage ? 'opacity-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]' : 'opacity-60'}`}>
          <div className="flex items-center gap-3 group cursor-default">
            <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden transition-all duration-300 ${backgroundImage ? 'bg-slate-900/80 backdrop-blur-md' : 'bg-linear-to-br from-slate-800 to-slate-900'}`}>
              <Cloud className="w-5 h-5 text-slate-100 opacity-30 group-hover:opacity-50 transition-opacity" />
              <Zap className="absolute inset-0 m-auto w-4.5 h-4.5 text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
            </div>
            <span className={`text-sm font-bold tracking-tight uppercase ${backgroundImage ? 'text-white' : 'text-slate-800'}`}>Tempesta <span className={backgroundImage ? 'text-white/70' : 'text-slate-400'}>Cloudy</span></span>
          </div>
          <p className={`text-xs font-bold uppercase tracking-widest ${backgroundImage ? 'text-white' : 'text-slate-500'}`}>
            &copy; 2024 Tempesta Cloudy
          </p>
          <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${backgroundImage ? 'text-white' : 'text-slate-400'}`}>
            Powered by KaeruShi X Rimiru
          </div>
        </div>
      </footer>
    </div>
  );
}
