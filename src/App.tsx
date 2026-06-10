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
  Archive,
  Edit2,
  Wrench,
  Settings,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Github,
  Moon,
  Sun,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRIS_BASE64 } from './qrisData';

interface FileMetadata {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadDate: number;
  type: 'file' | 'folder';
  parentId: string | null;
  githubReleaseTag?: string;
  downloadCount?: number;
}

export default function App() {
  const MAGIC_LINK_TOKEN = 'Tempest2271_Admin_99';

  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [view, setView] = useState<'home' | 'download' | 'login'>('home');
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Instant Login Initialization
  const [adminPassword, setAdminPassword] = useState(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const token = params.get('token');
    if (token === MAGIC_LINK_TOKEN) {
      localStorage.setItem('admin_pass', MAGIC_LINK_TOKEN);
      return MAGIC_LINK_TOKEN;
    }
    return localStorage.getItem('admin_pass') || '';
  });

  const [loginInput, setLoginInput] = useState('');
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return params.get('token') === MAGIC_LINK_TOKEN || !!localStorage.getItem('admin_pass');
  });

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<FileMetadata[]>([]);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [backgroundLocked, setBackgroundLocked] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeItemMenu, setActiveItemMenu] = useState<string | null>(null);
  const navigationCountRef = useRef(0);

  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showQrisModal, setShowQrisModal] = useState(false);

  const lowSpecMode = false;

  const [darkMode, setDarkMode] = useState(true);

  const toggleDarkMode = () => {
    // No-op to keep dark mode persistently active per user specification
  };

  const isDarkActive = !!(backgroundImage || darkMode);

  const animProps = (props: {
    initial?: any;
    animate?: any;
    exit?: any;
    transition?: any;
  }) => {
    return props;
  };

  const hoverTapProps = (scaleHover = 1.05, scaleTap = 0.95) => {
    return {
      whileHover: { scale: scaleHover },
      whileTap: { scale: scaleTap }
    };
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setBackgroundImage(data.backgroundImage || data.defaultBackground || '');
      
      const serverMaintenance = !!data.maintenanceMode;
      setMaintenanceMode(serverMaintenance);
      setBackgroundLocked(!!data.backgroundLocked);

      // Self-healing synchronization for maintenance state across stateless container instances
      const localAdminPass = localStorage.getItem('admin_pass') || '';
      if (localAdminPass) {
        const storedAdminMaintenanceState = localStorage.getItem('admin_maintenance_on');
        if (storedAdminMaintenanceState === 'true' && !serverMaintenance) {
          console.warn('Sync alert: Server lost maintenance state (likely scale-to-zero or container restart). Restoring maintenance mode from Admin session storage.');
          fetch('/api/settings/maintenance', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-admin-password': localAdminPass 
            },
            body: JSON.stringify({ enabled: true })
          }).then(repairRes => {
            if (repairRes.ok) {
              setMaintenanceMode(true);
            }
          });
        } else if (storedAdminMaintenanceState !== (serverMaintenance ? 'true' : 'false')) {
          localStorage.setItem('admin_maintenance_on', serverMaintenance ? 'true' : 'false');
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 5000); // Check every 5s for fast maintenance sync
    return () => clearInterval(interval);
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
    // 1. URL Cleanup for Magic Link
    const params = new URLSearchParams(window.location.search);
    if (params.get('token') === MAGIC_LINK_TOKEN) {
      window.history.replaceState({}, '', window.location.pathname);
      setView('home');
      return;
    }

    // 2. Standard Session Verification
    if (adminPassword && !isLoggedIn) {
      verifyAdmin(adminPassword);
    }
    
    // Check for direct download link and folder routing on popstate
    const handleUrl = async () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const urlFolderId = params.get('folderId');

      if (urlFolderId) {
        try {
          const res = await fetch(`/api/folder-path/${urlFolderId}`);
          if (res.ok) {
            const pathList = await res.json();
            setFolderStack(pathList);
            setCurrentFolderId(urlFolderId);
          } else {
            setFolderStack([]);
            setCurrentFolderId(null);
          }
        } catch (e) {
          console.error('Failed to sync folder path from URL params', e);
          setFolderStack([]);
          setCurrentFolderId(null);
        }
      } else {
        setFolderStack([]);
        setCurrentFolderId(null);
      }

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
    // Robust cleaning function to match backend
    const clean = (str: any) => (str || '').toString().trim().replace(/[\u200B-\u200D\uFEFF\s]/g, '');
    const cleanPass = clean(pass);
    
    if (!cleanPass) return;

    // Local offline fallback / master override
    if (cleanPass === 'Tempest2271' || cleanPass === MAGIC_LINK_TOKEN) {
      setIsLoggedIn(true);
      setAdminPassword(cleanPass);
      localStorage.setItem('admin_pass', cleanPass);
      if (window.location.pathname === '/admin') {
        window.history.pushState({}, '', '/');
        setView('home');
      } else {
        setView('home');
      }
      return;
    }

    setIsLoggingIn(true);
    setLoginError(false);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ password: cleanPass }),
      });
      if (res.ok) {
        setIsLoggedIn(true);
        setAdminPassword(cleanPass);
        localStorage.setItem('admin_pass', cleanPass);
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
      const ts = Date.now();
      const url = parentId ? `/api/files?parentId=${parentId}&t=${ts}` : `/api/files?t=${ts}`;
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

  const syncGithub = async () => {
    if (!isLoggedIn) return;
    setIsSyncingGithub(true);
    try {
      const res = await fetch('/api/admin/sync-github', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Synced successfully from GitHub');
        fetchFiles(currentFolderId);
      } else {
        alert(data.error || 'Failed to sync from GitHub');
      }
    } catch (err) {
      console.error(err);
      alert('Error syncing from GitHub');
    } finally {
      setIsSyncingGithub(false);
    }
  };

  const handleFolderCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isCreatingFolder) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('folderName') as string;
    if (!name) return;

    setIsCreatingFolder(true);
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
        fetchFiles(currentFolderId);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create folder');
      }
    } catch (err) {
      console.error('Failed to create folder', err);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const enterFolder = (folder: FileMetadata) => {
    setFolderStack([...folderStack, folder]);
    setCurrentFolderId(folder.id);
    window.history.pushState({ folderId: folder.id }, '', `?folderId=${folder.id}`);
    navigationCountRef.current++;
  };

  const goBack = () => {
    if (navigationCountRef.current > 0) {
      window.history.back();
      navigationCountRef.current--;
    } else {
      const newStack = [...folderStack];
      newStack.pop();
      const parent = newStack[newStack.length - 1];
      const parentId = parent ? parent.id : null;
      setFolderStack(newStack);
      setCurrentFolderId(parentId);
      window.history.pushState({ folderId: parentId }, '', parentId ? `?folderId=${parentId}` : '/');
    }
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
      e.target.value = '';
    }
  };

  const uploadFile = async (file: File) => {
    if (!isLoggedIn) {
      alert('Only admin can upload files!');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      alert('File is too large! Maximum size is 500MB.');
      return;
    }

    setUploadingFile(file);
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
        setUploadingFile(null);
        fetchFiles();
      } else {
        let errMsg = 'Upload failed';
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const err = await res.json();
            errMsg = err.error || errMsg;
          } else if (res.status === 413) {
            errMsg = 'File is too large to upload.';
          } else {
            errMsg = `Error: ${res.status} ${res.statusText}`;
          }
        } catch (e) {}
        alert(errMsg);
        setUploading(false);
        setUploadingFile(null);
      }
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
      setUploading(false);
      setUploadingFile(null);
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
        const err = await res.json();
        alert(err.error || 'Failed to upload background');
      }
    } catch (err) {
      console.error('Failed to upload background', err);
    } finally {
      setUploadingBg(false);
    }
  };

  const handleBackgroundUrl = async (url: string) => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch('/api/settings/background-url', {
        method: 'POST',
        headers: { 
          'x-admin-password': adminPassword,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        const data = await res.json();
        setBackgroundImage(data.url);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to set background URL');
      }
    } catch (err) {
      console.error('Failed to set background URL', err);
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
        fetchSettings();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to reset background');
      }
    } catch (err) {
      console.error('Failed to reset background', err);
    }
  };

  const toggleLockBackground = async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch('/api/settings/toggle-lock-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBackgroundLocked(data.locked);
      }
    } catch (err) {
      console.error('Toggle lock background failed', err);
    }
  };

  const toggleMaintenance = async () => {
    if (!isLoggedIn) return;
    const targetState = !maintenanceMode;
    try {
      const res = await fetch('/api/settings/maintenance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword 
        },
        body: JSON.stringify({ enabled: targetState })
      });
      if (res.ok) {
        setMaintenanceMode(targetState);
        localStorage.setItem('admin_maintenance_on', targetState ? 'true' : 'false');
      }
    } catch (err) {
      console.error('Toggle maintenance failed', err);
    }
  };

  const handleRename = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!renameInput.trim()) return;
    try {
      const res = await fetch('/api/rename', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword 
        },
        body: JSON.stringify({ id, newName: renameInput.trim() }),
      });
      if (res.ok) {
        setFiles(files.map(f => f.id === id ? { ...f, originalName: renameInput.trim() } : f));
        if (selectedFile?.id === id) {
          setSelectedFile({ ...selectedFile, originalName: renameInput.trim() });
        }
      }
    } catch (err) {
      console.error('Rename failed', err);
    } finally {
      setRenamingFileId(null);
      setRenameInput('');
    }
  };

  const moveFile = async (e: React.MouseEvent, index: number, direction: 'up' | 'down') => {
    e.stopPropagation();
    if (!isLoggedIn) return;
    
    if (searchTerm) {
      alert("Reordering is disabled while searching");
      return;
    }

    const newFiles = [...files];
    if (direction === 'up' && index > 0) {
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
    } else if (direction === 'down' && index < newFiles.length - 1) {
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
    } else {
      return;
    }

    setFiles(newFiles);

    const reorderedIds = newFiles.map(f => f.id);
    try {
      const res = await fetch('/api/reorder', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword 
        },
        body: JSON.stringify({ reorderedIds }),
      });
      if (!res.ok) throw new Error("Reorder failed");
    } catch (err) {
      console.error(err);
      fetchFiles();
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
    navigationCountRef.current++;
    fetchFiles(null);
  };

  useEffect(() => {
    fetchFiles();
  }, [currentFolderId]);

  const filteredFiles = files.filter(f => 
    f.originalName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingSettings) {
    return (
      <div className={`min-h-screen w-full flex flex-col items-center justify-center transition-colors duration-500 ${isDarkActive ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} font-sans`}>
        <div className="text-center space-y-4">
          <div className="relative w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md mx-auto overflow-hidden animate-pulse bg-linear-to-br from-slate-800 to-slate-900">
            <Cloud className="w-5 h-5 text-slate-100 opacity-40" />
            <Zap className="absolute inset-0 m-auto w-4.5 h-4.5 text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
          </div>
          <span className="text-sm font-black tracking-widest uppercase opacity-70">Tempesta Cloudy</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-500 w-full relative overflow-x-hidden ${isDarkActive ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} font-sans selection:bg-red-100 selection:text-red-900`}>
      {/* Background Layer (optimized for high FPS and smooth scrolling on CPU & GPU) */}
      <AnimatePresence>
        {backgroundImage && (
          <motion.div 
            key="custom-bg"
            {...animProps({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              transition: { duration: 0.2, ease: "linear" }
            })}
            className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none touch-none transform-gpu"
            style={{
              transform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform, opacity'
            }}
          >
            <img 
              src={backgroundImage} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover transform-gpu"
              style={{
                transform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform'
              }}
              decoding="async"
              loading="eager"
            />
            {/* Dark overlay to ensure text readability */}
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" 
              style={{
                transform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'backdrop-filter'
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Floating Blurry Tablet */}
      <header className="sticky top-4 z-50 px-4 mb-6">
        <div className={`max-w-6xl mx-auto h-14 px-4 flex items-center justify-between rounded-2xl border transition-[colors,transform,shadow] duration-150 transform-gpu ${
          isDarkActive ? 'bg-slate-950/75 backdrop-blur-md border-white/15 text-white shadow-lg' : 'bg-white/90 backdrop-blur-md max-md:backdrop-blur-[3px] border-slate-200 shadow-sm text-slate-800'
        }`}>
           <div 
            className="flex items-center gap-3 cursor-default select-none group" 
            
          >
            <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md md:group-hover:scale-105 transition-transform duration-150 transform-gpu overflow-hidden ${
              isDarkActive ? 'bg-slate-900/40 backdrop-blur-md border border-white/10' : 'bg-linear-to-br from-slate-800 to-slate-900'
            }`}>
              <Cloud className="w-4.5 h-4.5 text-slate-100 opacity-30 md:group-hover:scale-115 transition-transform duration-150" />
              <Zap className="logo-zap-electric absolute inset-0 m-auto w-4 h-4 text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
            </div>
            <div className="flex items-center select-none font-sans">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 450, damping: 12 }}
                className="logo-glitch-container cursor-default"
              >
                {/* 1. Underlying Main Text Layer (Static base that flutters lightly during glitches) */}
                <div className={`logo-glitch-base font-black tracking-tighter uppercase whitespace-nowrap text-base ${isDarkActive ? 'text-white' : 'text-slate-800'}`}>
                  Tempesta <span className="text-red-500">Cloudy</span>
                </div>

                {/* 2. Cyber Cyan Horizontal Slice Offset Layer */}
                <div 
                  className={`logo-glitch-slice-1 absolute inset-0 select-none pointer-events-none font-black tracking-tighter uppercase whitespace-nowrap text-base ${
                    isDarkActive ? 'text-white' : 'text-slate-800'
                  }`}
                  aria-hidden="true"
                >
                  Tempesta <span className="text-red-500">Cloudy</span>
                </div>

                {/* 3. Neon Magenta Horizontal Slice Offset Layer */}
                <div 
                  className={`logo-glitch-slice-2 absolute inset-0 select-none pointer-events-none font-black tracking-tighter uppercase whitespace-nowrap text-base ${
                    isDarkActive ? 'text-white' : 'text-slate-800'
                  }`}
                  aria-hidden="true"
                >
                  Tempesta <span className="text-red-500">Cloudy</span>
                </div>

                {/* 4. Interactive Laser Scanline */}
                <div className="logo-laser-line absolute left-0 right-0 pointer-events-none select-none" aria-hidden="true" />

                {/* 5. CRT Scanline & static grain overlay */}
                <div className="logo-cyber-crt absolute inset-0 pointer-events-none select-none" aria-hidden="true" />
              </motion.div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <nav className={`hidden md:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest drop-shadow-sm ${isDarkActive ? 'text-white font-black' : 'text-slate-600'}`}>
              <button onClick={navigateToHome} className="hover:text-red-400 transition-colors flex items-center gap-2 cursor-pointer"><Home className="w-3.5 h-3.5"/> Beranda</button>
              <button onClick={() => setShowQrisModal(true)} className="hover:text-pink-400 transition-colors flex items-center gap-2 cursor-pointer">
                <Heart className="w-3.5 h-3.5"/> Traktir Kopi 😄
              </button>
            </nav>
            <div className={`h-5 w-px hidden md:block ${isDarkActive ? 'bg-white/20' : 'bg-slate-200'}`} />
            
            {/* Dark Mode Toggle Logo/Icon */}
            <motion.button 
              {...hoverTapProps(1.1, 0.9)}
              onClick={toggleDarkMode}
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                isDarkActive 
                  ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' 
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? (
                <Sun className="w-4.5 h-4.5 text-amber-500 fill-amber-300 animate-[spin_10s_linear_infinite]" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-slate-700 fill-slate-300" />
              )}
            </motion.button>

            {/* Mobile Menu Toggle */}
            <button 
              className={`md:hidden p-2 rounded-xl transition-all relative overflow-hidden flex items-center justify-center cursor-pointer ${isDarkActive ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'text-slate-600 hover:bg-slate-100 bg-slate-50'}`}
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              style={{ width: '38px', height: '38px' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={showMobileMenu ? "close" : "menu"}
                  initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="flex items-center justify-center transform-gpu"
                >
                  {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </motion.div>
              </AnimatePresence>
            </button>
            
            {isLoggedIn ? (
              <div className="relative" ref={adminMenuRef}>
                <button 
                  onClick={() => setShowAdminMenu(!showAdminMenu)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shadow-sm ${
                    isDarkActive ? 'bg-white/20 backdrop-blur-md text-white border-white/20 hover:bg-white/30 drop-shadow-sm' : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                  }`}
                >
                   <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDarkActive ? 'bg-white' : 'bg-red-500'}`} />
                   Admin
                </button>
                
                <AnimatePresence>
                  {showAdminMenu && (
                    <motion.div 
                      {...animProps({
                        initial: { opacity: 0, y: 10, scale: 0.95 },
                        animate: { opacity: 1, y: 0, scale: 1 },
                        exit: { opacity: 0, y: 10, scale: 0.95 },
                        transition: { duration: 0.2, ease: "easeOut" }
                      })}
                      className={`absolute right-0 mt-2 w-48 border rounded-xl shadow-lg p-1 z-[60] overflow-hidden ${
                        isDarkActive ? 'bg-slate-950/90 backdrop-blur-md border border-white/10 text-white shadow-2xl' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className={`px-3 py-2 text-[10px] uppercase tracking-widest font-bold border-b mb-1 ${
                        isDarkActive ? 'text-slate-400 border-white/10' : 'text-slate-400 border-slate-100'
                      }`}>
                        Display Settings
                      </div>
                      <button 
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                          backgroundLocked 
                            ? 'text-slate-400 opacity-50 cursor-not-allowed' 
                            : (isDarkActive ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100')
                        }`}
                        onClick={() => {
                          if (backgroundLocked) return;
                          setShowAdminMenu(false);
                          bgInputRef.current?.click();
                        }}
                        disabled={backgroundLocked}
                      >
                        <Upload className="w-3.5 h-3.5 text-red-500" />
                        {uploadingBg ? 'Changing...' : 'Themes Background'}
                      </button>

                      {backgroundImage && (
                        <button 
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                            backgroundLocked 
                              ? 'text-slate-400 opacity-50 cursor-not-allowed' 
                              : (isDarkActive ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-red-650 hover:bg-slate-100')
                          }`}
                          onClick={() => {
                            if (backgroundLocked) return;
                            setShowAdminMenu(false);
                            resetBackground();
                          }}
                          disabled={backgroundLocked}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Clear Background
                        </button>
                      )}

                      <button 
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                          backgroundLocked 
                            ? 'text-amber-500 hover:bg-amber-500/10' 
                            : (isDarkActive ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100')
                        }`}
                        onClick={() => {
                          setShowAdminMenu(false);
                          toggleLockBackground();
                        }}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {backgroundLocked ? 'Unlock Theme' : 'Lock Theme'}
                      </button>

                      <button 
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                          isDarkActive ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                        onClick={() => {
                          setShowAdminMenu(false);
                          toggleDarkMode();
                        }}
                      >
                        <Moon className={`w-3.5 h-3.5 ${darkMode ? 'text-amber-400 fill-amber-300' : 'text-red-500'}`} />
                        {darkMode ? 'Dark Mode: ON' : 'Dark Mode: OFF'}
                      </button>
                      
                      <div className={`h-px my-1 ${isDarkActive ? 'bg-white/10' : 'bg-slate-100'}`} />
                      <div className={`px-3 py-2 text-[10px] uppercase tracking-widest font-bold border-b mb-1 ${
                        isDarkActive ? 'text-slate-400 border-white/10' : 'text-slate-400 border-slate-100'
                      }`}>
                        System
                      </div>
                      
                      <button 
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                          maintenanceMode 
                            ? 'text-amber-500 hover:bg-amber-500/10' 
                            : (isDarkActive ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100')
                        }`}
                        onClick={() => {
                          setShowAdminMenu(false);
                          toggleMaintenance();
                        }}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        {maintenanceMode ? 'Maintenance Mode: ON' : 'Maintenance Mode: OFF'}
                      </button>

                      <button 
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${
                          isDarkActive ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
                        }`}
                        onClick={() => {
                          setShowAdminMenu(false);
                          syncGithub();
                        }}
                        disabled={isSyncingGithub}
                      >
                        <Github className="w-3.5 h-3.5" />
                        {isSyncingGithub ? 'Syncing...' : 'Sync from GitHub'}
                      </button>

                      <button 
                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
                          isDarkActive ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-slate-500 hover:bg-slate-100'
                        }`}
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
                <div 
                  className={`text-[10px] md:text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-wider select-none ${
                    isDarkActive 
                      ? 'bg-white/10 text-white/80 border border-white/15 backdrop-blur-xs' 
                      : 'bg-slate-200 text-slate-600 border border-slate-300 shadow-sm'
                  }`}
                >
                  <span>Guest</span>
                </div>
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp"
              ref={bgInputRef} 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  uploadBackground(e.target.files[0]);
                }
                e.target.value = '';
              }} 
            />
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showMobileMenu && (
          <motion.div 
            {...animProps({
              initial: { opacity: 0, y: -10, height: 0 },
              animate: { opacity: 1, y: 0, height: 'auto' },
              exit: { opacity: 0, y: -10, height: 0 },
              transition: { 
                height: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.12, ease: "linear" },
                y: { duration: 0.18, ease: "easeOut" }
              }
            })}
            className={`md:hidden border-b overflow-hidden z-40 relative transform-gpu ${
              isDarkActive ? 'bg-slate-950/70 backdrop-blur-sm border-white/20' : 'bg-white border-slate-200'
            }`}
            style={{
              willChange: "height, opacity, transform",
              backfaceVisibility: "hidden"
            }}
          >
            <div className="px-4 py-4 space-y-4">
              <button 
                onClick={() => { navigateToHome(); setShowMobileMenu(false); }} 
                className={`w-full text-left font-bold flex items-center gap-3 p-3 rounded-xl transition-colors drop-shadow-sm ${
                  isDarkActive ? 'text-white hover:bg-white/20' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Home className="w-5 h-5 text-red-500" /> Beranda
              </button>
              <button 
                onClick={() => { setShowQrisModal(true); setShowMobileMenu(false); }} 
                className={`w-full text-left font-bold flex items-center gap-3 p-3 rounded-xl transition-colors drop-shadow-sm cursor-pointer ${
                  isDarkActive ? 'text-white hover:bg-white/20' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Heart className="w-5 h-5 text-pink-500" /> Traktir Kopi 😄
              </button>
              {isLoggedIn && (
                <button 
                  onClick={() => { toggleMaintenance(); setShowMobileMenu(false); }} 
                  className={`w-full text-left font-bold flex items-center gap-3 p-3 rounded-xl transition-colors drop-shadow-sm ${
                    maintenanceMode 
                      ? 'text-amber-500 hover:bg-amber-500/10' 
                      : (isDarkActive ? 'text-white hover:bg-white/20' : 'text-slate-700 hover:bg-slate-50')
                  }`}
                >
                  <Wrench className="w-5 h-5" /> {maintenanceMode ? 'Maintenance: ON' : 'Maintenance: OFF'}
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
                {...animProps({
                  initial: { opacity: 0, y: 10 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: -10 }
                })}
                className="max-w-sm mx-auto pt-6 sm:pt-20 landscape:pt-4"
              >
                <div className={`p-8 rounded-2xl border shadow-lg transition-colors duration-150 ${
                  isDarkActive ? 'bg-slate-950 border-white/10 text-white shadow-2xl' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="text-center mb-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 border transition-colors duration-150 ${isDarkActive ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      <Lock className="w-6 h-6" />
                    </div>
                    <h2 className={`text-xl font-black uppercase tracking-tight drop-shadow-sm ${isDarkActive ? 'text-white' : 'text-slate-800'}`}>Admin Login</h2>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-2 drop-shadow-sm ${isDarkActive ? 'text-white/80' : 'text-slate-400'}`}>Authorization Protocol</p>
                    {loginError && (
                      <motion.p 
                        {...animProps({
                          initial: { opacity: 0, scale: 0.9 },
                          animate: { opacity: 1, scale: 1 }
                        })}
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
                      className={`w-full px-4 py-3 border rounded-xl outline-none transition-all text-sm font-bold ${isDarkActive ? 'bg-white/20 border-white/30 focus:bg-white/40 focus:border-red-400 text-white placeholder-white/50' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500 focus:ring-2 focus:ring-red-500/25 focus:border-red-500'} ${loginError ? 'border-red-500/50' : ''}`}
                      autoFocus
                    />
                    <button 
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-[0.98] text-xs shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isLoggingIn ? 'Authenticating...' : 'Verify'}
                    </button>
                    <button 
                      type="button"
                      onClick={navigateToHome}
                      className={`w-full py-2 font-black text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${isDarkActive ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              </motion.div>
          ) : maintenanceMode && !isLoggedIn ? (
              <motion.div
                key="maintenance"
                {...animProps({
                  initial: { opacity: 0, scale: 0.98 },
                  animate: { opacity: 1, scale: 1 },
                  exit: { opacity: 0, scale: 0.98 }
                })}
                className="max-w-md mx-auto pt-10 sm:pt-20 px-4"
              >
                <div className={`p-6 sm:p-10 rounded-xl sm:rounded-2xl border shadow-lg text-center transition-colors duration-150 ${
                  isDarkActive ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-200'
                }`}>
                  <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 border transition-all overflow-hidden ${isDarkActive ? 'bg-white/10 border-white/20 text-white' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
                    <Settings className="w-10 h-10 sm:w-12 sm:h-12 absolute animate-[spin_10s_linear_infinite] opacity-30 text-amber-500" />
                    <Lock className="w-6 h-6 sm:w-8 sm:h-8 relative z-10" />
                  </div>
                  <h2 className={`text-lg sm:text-2xl font-black uppercase tracking-tight drop-shadow-sm mb-3 sm:mb-4 ${isDarkActive ? 'text-white' : 'text-slate-800'}`}>Sedang Dalam Pemeliharaan</h2>
                  <p className={`text-xs sm:text-sm font-bold uppercase tracking-widest mx-auto max-w-xs sm:max-w-sm mb-1.5 sm:mb-2 ${isDarkActive ? 'text-white/80' : 'text-slate-500'}`}>Server sedang dioptimalkan agar layanan lebih baik.</p>
                  <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-widest mx-auto max-w-sm animate-pulse ${isDarkActive ? 'text-white/50' : 'text-slate-400'}`}>Mohon tunggu sebentar...</p>
                </div>
              </motion.div>
          ) : view === 'home' ? (
            <motion.div
              key="home"
              {...animProps({
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 }
              })}
              className="space-y-6"
            >
              {/* Support Banner - ItsNoMercy style */}
              <div className={`rounded-2xl p-6 text-white relative overflow-hidden group transition-[colors,transform] duration-150 border ${
                isDarkActive ? 'bg-red-950/95 border-red-900/40 shadow-xs' : 'bg-red-600 border-red-700'
              }`}>
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-150">
                    <Heart className="w-24 h-24" />
                 </div>
                 <div className="relative z-10 space-y-2">
                    <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 animate-none">SUPPORT US! 🔥</h2>
                    <p className={`text-sm max-w-lg font-bold ${isDarkActive ? 'text-white' : 'text-red-100'}`}>Support kami agar bisa terus melakukan update setiap hari dan tetap menyediakan layanan gratis!</p>
                    <div className="flex gap-3 pt-3">
                       <button onClick={() => setShowQrisModal(true)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer ${
                         isDarkActive ? 'bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/20' : 'bg-white text-red-600 hover:bg-red-50'
                       }`}>Traktir Kopi 😄</button>
                    </div>
                 </div>
              </div>

              {/* Breadcrumbs & Controls Unified Tablet */}
              <div className={`flex items-center justify-between p-2 rounded-2xl border shadow-md w-full transition-all duration-150 relative z-20 ${
                isDarkActive ? 'bg-slate-950/75 backdrop-blur-md border-white/15 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                {/* Left side: Path trail */}
                <div className="flex items-center gap-2 text-sm font-medium px-2 py-1.5 grow overflow-x-auto whitespace-nowrap scrollbar-hide min-w-0">
                  <FolderOpen className="w-4 h-4 text-red-500 shrink-0" />
                  <span 
                    className={`hover:text-red-500 cursor-pointer font-bold transition-colors shrink-0 ${isDarkActive ? 'text-white hover:text-red-400 drop-shadow-xs' : 'text-slate-800'}`} 
                    onClick={navigateToHome}
                  >
                    Listed App
                  </span>
                  {folderStack.map((folder, i) => (
                    <React.Fragment key={folder.id}>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isDarkActive ? 'text-white/40' : 'text-slate-400'}`} />
                      <span 
                        className={`cursor-pointer hover:text-red-500 transition-colors shrink-0 ${
                          i === folderStack.length - 1 
                            ? (isDarkActive ? 'text-white font-black drop-shadow-xs' : 'text-slate-900 font-bold') 
                            : (isDarkActive ? 'text-white/70 hover:text-white drop-shadow-xs' : 'text-slate-500')
                        }`}
                        onClick={() => {
                          const newStack = folderStack.slice(0, i + 1);
                          setFolderStack(newStack);
                          setCurrentFolderId(folder.id);
                          window.history.pushState({ folderId: folder.id }, '', `?folderId=${folder.id}`);
                          navigationCountRef.current++;
                        }}
                      >
                        {folder.originalName}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Right side: Button Controls */}
                <div className={`flex items-center gap-1.5 shrink-0 pl-2 border-l ${isDarkActive ? 'border-white/10' : 'border-slate-100'}`}>
                  <motion.button 
                    {...hoverTapProps(1.05, 0.95)}
                    onClick={() => fetchFiles()}
                    className={`p-2 rounded-xl transition-colors duration-150 flex items-center justify-center cursor-pointer ${
                      isDarkActive 
                        ? 'text-white/80 hover:text-white hover:bg-white/10' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </motion.button>
                  {isLoggedIn && (
                    <div className="relative group">
                      <motion.button 
                        {...hoverTapProps(1.05, 0.95)}
                        className={`p-2 rounded-xl transition-colors duration-150 flex items-center justify-center cursor-pointer ${
                          isDarkActive 
                            ? 'text-white/80 hover:text-white hover:bg-white/10' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                        title="More Options"
                      >
                        <Menu className="w-4 h-4" />
                      </motion.button>
                      <div className={`absolute right-0 top-full mt-2 w-44 rounded-2xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[60] transform origin-top-right scale-95 group-hover:scale-100 p-1 border ${
                        isDarkActive ? 'bg-slate-950/95 backdrop-blur-md border border-white/10 text-white shadow-xl' : 'bg-white border-slate-200'
                      }`}>
                        <button className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2 ${isDarkActive ? 'text-white' : 'text-slate-600'}`} onClick={() => fetchFiles()}>
                          <RefreshCw className="w-3.5 h-3.5 text-red-500" />
                          Force Sync
                        </button>
                        <button className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2 ${isDarkActive ? 'text-white' : 'text-slate-600'}`} onClick={navigateToHome}>
                          <Home className="w-3.5 h-3.5 text-red-500" />
                          Terminal Home
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Container */}
              <div className={`rounded-2xl shadow-md overflow-hidden min-h-[400px] transition-colors duration-150 relative z-10 border ${
                isDarkActive ? 'bg-slate-950/40 backdrop-blur-md border border-white/10 shadow-lg' : 'bg-white border-slate-200'
              }`}>
                {/* Control Bar */}
                <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-150 ${isDarkActive ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="relative flex-1 max-w-md">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkActive ? 'text-white/60' : 'text-slate-400'}`} />
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search files..." 
                      className={`pl-10 pr-4 py-2 border rounded-xl text-sm w-full outline-none transition-colors duration-150 font-bold ${
                        isDarkActive ? 'bg-white/10 border-white/20 text-white placeholder-white/50 focus:bg-white/20 focus:border-red-400' : 'bg-slate-50 border-slate-300 text-slate-950 placeholder-slate-500 focus:ring-2 focus:ring-red-500/15 focus:border-red-500'
                      }`}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 md:justify-end shrink-0">
                    {folderStack.length > 0 && (
                      <motion.button 
                        {...hoverTapProps(1.05, 0.95)}
                        onClick={goBack}
                        className={`group px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 border transition-all duration-150 shadow-sm cursor-pointer ${
                          isDarkActive 
                            ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-400' 
                            : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100/80 shadow-xs'
                        }`}
                        title="Go Back"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-translate-x-1" />
                        <span>Back...</span>
                      </motion.button>
                    )}

                    {isLoggedIn && (
                      <>
                        <button 
                           onClick={() => setShowFolderInput(!showFolderInput)}
                           className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors duration-150 cursor-pointer ${
                             isDarkActive ? 'bg-white/20 hover:bg-white/30 border border-white/20 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                           }`}
                        >
                           <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                           Directory
                        </button>
                        <button 
                           onClick={() => fileInputRef.current?.click()}
                           disabled={uploading}
                           className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-colors duration-150 active:scale-95 disabled:opacity-50 shadow-lg shadow-red-600/20 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploading ? `${uploadProgress}%` : 'Upload'}
                        </button>
                      </>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                </div>

                <AnimatePresence>
                  {showFolderInput && (
                    <motion.div 
                      {...animProps({
                        initial: { opacity: 0, height: 0 },
                        animate: { opacity: 1, height: 'auto' },
                        exit: { opacity: 0, height: 0 },
                        transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
                      })}
                      className={`overflow-hidden border-b transform-gpu ${
                        isDarkActive ? 'bg-slate-900/80 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-950 shadow-inner'
                      }`}
                      style={{
                        willChange: "height, opacity",
                        backfaceVisibility: "hidden"
                      }}
                    >
                      <div className="p-4">
                        <form onSubmit={handleFolderCreate} className="flex gap-2">
                           <input 
                            name="folderName"
                            type="text"
                            required
                            placeholder="Folder Name"
                            className={`flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none transition-colors duration-150 font-black ${
                              isDarkActive 
                                ? 'bg-slate-950 border-white/30 text-white placeholder-white/50 focus:border-red-500' 
                                : 'bg-white border-slate-400 text-black placeholder-slate-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                            }`}
                            autoFocus
                            disabled={isCreatingFolder}
                           />
                           <button type="submit" disabled={isCreatingFolder} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer">Create</button>
                           <button 
                             type="button" 
                             disabled={isCreatingFolder} 
                             onClick={() => setShowFolderInput(false)} 
                             className={`px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer ${
                               isDarkActive ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                             }`}
                           >
                             Cancel
                           </button>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* File List Header */}
                <div className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_80px_120px_auto] gap-4 px-6 py-2 text-[10px] font-bold uppercase tracking-widest border-b ${isDarkActive ? 'bg-white/10 text-white border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.1)]' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                   <span>Name</span>
                   <span className="hidden md:block text-center">Size</span>
                   <span className="hidden md:block text-right">Date</span>
                   <span></span>
                </div>

                {/* List Content */}
                <motion.div 
                  key={currentFolderId || 'root'}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className={`divide-y transform-gpu ${isDarkActive ? 'divide-white/10' : 'divide-slate-50'}`}
                  style={{ willChange: "transform, opacity" }}
                >
                  {filteredFiles.map((file, index) => (
                    <motion.div 
                      key={file.id}
                      whileTap={{ scale: 0.985 }}
                      className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_80px_120px_auto] gap-4 items-center px-6 py-3.5 transition-colors group cursor-pointer transform-gpu ${isDarkActive ? 'hover:bg-white/10' : 'hover:bg-slate-50'}`}
                      onClick={() => file.type === 'folder' ? enterFolder(file) : window.location.href = `/download/${file.id}`}
                      style={{ willChange: "transform" }}
                    >
                       <div className="flex items-center gap-3 min-w-0 pr-2 grow">
                          {isLoggedIn && !searchTerm && (
                            <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity justify-center shrink-0 font-medium">
                              <button
                                onClick={(e) => moveFile(e, index, 'up')}
                                disabled={index === 0}
                                className={`p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent ${index === 0 ? 'invisible' : ''}`}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => moveFile(e, index, 'down')}
                                disabled={index === filteredFiles.length - 1}
                                className={`p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent ${index === filteredFiles.length - 1 ? 'invisible' : ''}`}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {file.type === 'folder' ? (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-md border transition-all duration-300 group-hover:scale-110 ${isDarkActive ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                              <FolderOpen className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${isDarkActive ? 'bg-red-400/20 text-red-300 border border-red-400/30' : 'bg-red-50 text-red-500'}`}>
                               <File className="w-4 h-4" />
                            </div>
                          )}
                          {renamingFileId === file.id ? (
                            <form 
                              onSubmit={(e) => handleRename(e, file.id)} 
                              className="flex gap-2 w-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input 
                                type="text"
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                className={`flex-1 px-3 py-1 border rounded-lg text-sm font-black outline-none ${isDarkActive ? 'bg-white/20 border-white/30 text-white placeholder-white/50 focus:border-red-400 focus:bg-white/30' : 'bg-white border-slate-300 text-black placeholder-slate-500 focus:border-red-500'}`}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button type="submit" className="px-3 py-1 bg-red-600/90 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer">Save</button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setRenamingFileId(null); }} className="px-3 py-1 bg-slate-500/90 text-white rounded-lg text-xs font-bold hover:bg-slate-600 transition-colors cursor-pointer">Cancel</button>
                            </form>
                          ) : (
                            <div className="flex flex-col min-w-0 pr-2">
                              <span style={{ wordBreak: 'break-word' }} className={`text-sm md:text-base font-bold transition-colors ${isDarkActive ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:text-red-300' : 'text-slate-800 group-hover:text-red-600'}`}>{file.originalName}</span>
                              <div className={`flex text-[10px] gap-2 mt-0.5 ${isDarkActive ? 'text-white/60 drop-shadow-sm' : 'text-slate-400'}`}>
                                {file.type === 'folder' ? (
                                  <span className="font-bold text-red-500/95 dark:text-red-400/95 tracking-wider uppercase text-[9px]">
                                    {file.originalName.toLowerCase().includes('kaedex') ? 'Codex lite' : 'Delta lite'}
                                  </span>
                                ) : (
                                  <>
                                    <div className="flex md:hidden gap-2 items-center">
                                      <span>{formatSize(file.size)}</span>
                                      <span>•</span>
                                      <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 border border-emerald-500/35 dark:border-emerald-400/30 font-extrabold px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider shrink-0 shadow-sm shadow-emerald-500/5">
                                      <span>Latest</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                       </div>
                       <span className={`hidden md:block text-center text-xs font-medium ${isDarkActive ? 'text-white/80 drop-shadow-sm' : 'text-slate-500'}`}>{file.type === 'folder' ? '-' : formatSize(file.size)}</span>
                       <span className={`hidden md:block text-right text-xs font-medium ${isDarkActive ? 'text-white/60 drop-shadow-sm' : 'text-slate-400'}`}>{file.type === 'folder' ? '-' : new Date(file.uploadDate).toLocaleDateString()}</span>
                       {renamingFileId !== file.id && (
                         <div className="flex justify-end gap-1.5 relative shrink-0 items-center">
                            {file.type !== 'folder' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/download/${file.id}`;
                                }}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                title="Download"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            )}
                            
                            {isLoggedIn && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingFileId(file.id);
                                    setRenameInput(file.originalName);
                                  }}
                                  className="p-1.5 rounded-lg text-blue-400 hover:text-white hover:bg-blue-500 transition-all md:opacity-0 md:group-hover:opacity-100 opacity-100"
                                  title="Rename Resource"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteItem(file.id, file.originalName);
                                  }}
                                  className="p-1.5 rounded-lg text-red-500 hover:text-white hover:bg-red-500 transition-all md:opacity-0 md:group-hover:opacity-100 opacity-100"
                                  title="Delete Resource"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                         </div>
                       )}
                    </motion.div>
                  ))}
                  {filteredFiles.length === 0 && !uploading && (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-300 space-y-3">
                       <FolderOpen className="w-12 h-12 opacity-20" />
                       <p className="text-sm font-medium">Directory is empty or no matches found.</p>
                    </div>
                  )}
                  {uploading && (
                    <div className="p-10 flex flex-col items-center justify-center space-y-4">
                       <div className="text-center space-y-1 mb-2">
                         {uploadingFile && (
                           <>
                             <div style={{ wordBreak: 'break-word' }} className={`text-base font-bold ${isDarkActive ? 'text-white' : 'text-slate-800'}`}>
                               {uploadingFile.name}
                             </div>
                             <div className={`flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest ${isDarkActive ? 'text-white/60' : 'text-slate-400'}`}>
                               <span>{formatSize(uploadingFile.size)}</span>
                               <span>{new Date().toLocaleDateString()}</span>
                             </div>
                           </>
                         )}
                       </div>
                       <div className="w-full max-w-xs h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            className="bg-red-600 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                          />
                       </div>
                       <p className="text-[10px] font-black uppercase text-red-600 tracking-widest animate-pulse drop-shadow-sm">Streaming to cloud node...</p>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="download"
              {...animProps({
                initial: { opacity: 0, scale: 0.98 },
                animate: { opacity: 1, scale: 1 },
                exit: { opacity: 0, scale: 0.98 }
              })}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className={`rounded-2xl shadow-lg overflow-hidden relative z-10 border transition-colors duration-150 ${
                isDarkActive ? 'bg-slate-950/40 backdrop-blur-md border border-white/10 text-white shadow-xl' : 'bg-white border-slate-200'
              }`}>
                <div className="h-2 bg-red-600" />
                <div className="p-8 landscape:p-4.5 md:p-12 text-center space-y-8 landscape:space-y-4.5">
                  <div className={`w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto transition-colors border shadow-inner ${
                    isDarkActive ? 'bg-white/10 border-white/20 text-white drop-shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}>
                    <File className="w-7 h-7 md:w-10 md:h-10" />
                  </div>
                  
                  <div className="space-y-4">
                    {renamingFileId === selectedFile?.id && selectedFile ? (
                        <form 
                          onSubmit={(e) => handleRename(e, selectedFile.id)} 
                          className="flex flex-wrap sm:flex-nowrap gap-2 w-full mt-2 mb-2 justify-center max-w-md mx-auto"
                        >
                          <input 
                            type="text"
                            value={renameInput}
                            onChange={(e) => setRenameInput(e.target.value)}
                            className={`flex-1 w-full min-w-[200px] px-3 py-1.5 border rounded-lg text-lg font-black outline-none ${isDarkActive ? 'bg-white/20 border-white/30 text-white placeholder-white/50 focus:border-red-400 focus:bg-white/30' : 'bg-white border-slate-300 text-black placeholder-slate-500 focus:border-red-500'}`}
                            autoFocus
                          />
                          <div className="flex gap-2 w-full justify-center sm:w-auto">
                            <button type="submit" className="px-4 py-1.5 bg-red-600/90 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors cursor-pointer">Save</button>
                            <button type="button" onClick={() => setRenamingFileId(null)} className="px-4 py-1.5 bg-slate-500/90 text-white rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors cursor-pointer">Cancel</button>
                          </div>
                        </form>
                    ) : (
                        <h1 style={{ wordBreak: 'break-word' }} className={`text-2xl font-black tracking-tighter uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex flex-wrap items-center justify-center gap-2 ${isDarkActive ? 'text-white' : 'text-slate-800'}`}>
                          {selectedFile?.originalName}
                          {isLoggedIn && selectedFile && (
                             <button 
                               onClick={() => { setRenamingFileId(selectedFile.id); setRenameInput(selectedFile.originalName); }}
                               className="p-1.5 rounded-lg text-blue-400 hover:text-white hover:bg-blue-500 transition-all opacity-50 hover:opacity-100 cursor-pointer"
                             >
                                <Edit2 className="w-5 h-5" />
                             </button>
                          )}
                        </h1>
                    )}
                    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-widest ${isDarkActive ? 'text-white/70' : 'text-slate-400'}`}>
                      <span>{formatSize(selectedFile?.size || 0)}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isDarkActive ? 'bg-white/40' : 'bg-slate-200'}`} />
                      <span>Ready for Transmission</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isDarkActive ? 'bg-white/40' : 'bg-slate-200'}`} />
                      <span className="bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 border border-emerald-500/35 dark:border-emerald-400/30 font-extrabold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider shrink-0 shadow-sm shadow-emerald-500/5">
                        Latest
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3.5 max-w-sm landscape:max-w-lg mx-auto w-full pt-4 landscape:pt-2">
                    <div className="grid grid-cols-1 landscape:grid-cols-2 gap-3">
                      <a 
                        href={`/download/${selectedFile?.id}`}
                        className="w-full py-3 landscape:py-2.5 sm:py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-xl shadow-red-600/30 active:scale-95 text-xs text-center"
                      >
                        <Download className="w-5 h-5 shrink-0" />
                        <span>DOWNLOAD FILE</span>
                      </a>
                      <button 
                        onClick={() => selectedFile && copyLink(selectedFile.id)}
                        className={`w-full py-3 landscape:py-2.5 sm:py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all border text-xs cursor-pointer ${isDarkActive ? 'bg-white/20 border-white/30 text-white hover:bg-white/30 shadow-lg shadow-black/5' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        <Share2 className="w-4 h-4 shrink-0" />
                        <span>Copy Origin URL</span>
                      </button>
                    </div>
                    {isLoggedIn && selectedFile && (
                      <button 
                        onClick={() => deleteItem(selectedFile.id, selectedFile.originalName)}
                        className="w-full py-2.5 bg-red-100 text-red-600 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-red-200 hover:bg-red-200 text-xs shadow-xs"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Delete Permanently</span>
                      </button>
                    )}
                    <button 
                      onClick={navigateToHome}
                      className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors py-2 cursor-pointer ${isDarkActive ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
                    >
                      Back to Matrix
                    </button>
                  </div>

                  <div className={`pt-8 border-t flex items-center justify-center gap-8 grayscale opacity-50 ${isDarkActive ? 'border-white/10' : 'border-slate-100'}`}>
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

      <footer className={`max-w-6xl mx-auto px-4 py-12 border-t mt-12 mb-8 transition-all ${isDarkActive ? 'border-white/10' : 'border-slate-200'}`}>
        <div className={`flex flex-col md:flex-row items-center justify-between gap-6 ${isDarkActive ? 'opacity-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]' : 'opacity-60'}`}>
          <div className="flex items-center gap-3 group cursor-default">
            <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden transition-all duration-300 ${isDarkActive ? 'bg-slate-900/80 backdrop-blur-md' : 'bg-linear-to-br from-slate-800 to-slate-900'}`}>
              <Cloud className="w-5 h-5 text-slate-100 opacity-30 group-hover:opacity-50 transition-opacity" />
              <Zap className="absolute inset-0 m-auto w-4.5 h-4.5 text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
            </div>
            <span className={`text-sm font-bold tracking-tight uppercase ${isDarkActive ? 'text-white' : 'text-slate-800'}`}>Tempesta <span className={isDarkActive ? 'text-white/70' : 'text-slate-400'}>Cloudy</span></span>
          </div>
          <p className={`text-xs font-bold uppercase tracking-widest ${isDarkActive ? 'text-white' : 'text-slate-500'}`}>
            &copy; 2024 Tempesta Cloudy
          </p>
          <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkActive ? 'text-white' : 'text-slate-400'}`}>
            Powered by KaeruShi X Rimiru
          </div>
        </div>
      </footer>

      {/* Announcement Modal Overlay */}
      <AnimatePresence>
        {showAnnouncement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex justify-center p-4 overflow-y-auto w-full h-full"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.15 }}
              className={`relative w-full max-w-lg my-auto rounded-3xl overflow-hidden border transition-all duration-300 shadow-[0_0_60px_-15px_rgba(239,68,68,0.4)] ${
                isDarkActive 
                  ? 'bg-slate-950/80 border-white/10 text-white backdrop-blur-xl' 
                  : 'bg-slate-950/85 border-white/15 text-white backdrop-blur-xl'
              }`}
            >
              {/* Top Neon Accent Strip */}
              <div className="h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-600" />

              {/* Decorative Subtle Radial Radial Shadow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button X */}
              <button
                onClick={() => {
                  setShowAnnouncement(false);
                }}
                className="absolute top-5 right-5 z-50 p-2 rounded-full transition-all duration-150 cursor-pointer text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close Announcement"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-5 md:p-8 landscape:p-4 space-y-4 md:space-y-6 landscape:space-y-3 relative z-10 animate-none">
                {/* Warning Header Symbol */}
                <div className="flex items-center gap-3 md:gap-3.5">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 animate-pulse shrink-0">
                    <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-red-400 block mb-0.5">Alert Announcement</span>
                    <h3 className="text-lg md:text-2xl font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-white to-red-200">
                      PENTING! BACA INI DULU!
                    </h3>
                  </div>
                </div>

                {/* Message Body */}
                <div className="space-y-3 md:space-y-4 landscape:space-y-2 text-xs md:text-[15px] leading-relaxed text-slate-300">
                  <p className="font-extrabold text-white text-sm md:text-base">
                    Halo para member di luar sana! 👋
                  </p>
                  <p>
                    Berhubung lagi marak banget oknum penipuan yang mengatasnamakan <span className="font-black text-red-400 underline decoration-red-500/50 underline-offset-4">TempestaCloudy</span> dan meminta bayaran secara ilegal, kami mau ngingetin biar kamu gak gampang terkecoh.
                  </p>
                  
                  {/* Highlighted Link Section (Glassmorphism with red stroke) */}
                  <div className="p-3 md:p-5 rounded-2xl border bg-gradient-to-b from-red-500/5 to-transparent border-red-500/20 shadow-[inset_0_1px_20px_rgba(239,68,68,0.05)] text-center my-3 landscape:my-1.5">
                    <p className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-black text-red-400 mb-1 md:mb-2">
                      Ingat ya, website official kita CUMA SATU:
                    </p>
                    <a 
                      href="https://tempestacloudy.my.id" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm md:text-xl font-black text-red-400 hover:text-red-300 hover:scale-103 transition-all duration-200 hover:underline hover:underline-offset-4"
                    >
                      <span className="text-xs md:text-lg">🌐 Tempestacloudy.my.id</span>
                      <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400 shrink-0" />
                    </a>
                  </div>

                  <p className="font-bold text-white leading-snug">
                    Kami tidak bertanggung jawab kalau kamu pakai aplikasi yang bukan dari web resmi kami.
                  </p>

                  <p className="text-slate-400 text-[10px] md:text-sm">
                    Jadi, pastikan selalu cek ulang! Tetap aman dan <span className="italic font-bold text-red-400">Always Enjoy... 😄</span>
                  </p>
                </div>

                {/* Confirm/Dismiss Buttons */}
                <div className="pt-1.5 md:pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAnnouncement(false);
                    }}
                    className="w-full py-3 md:py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-200 shadow-md shadow-red-500/20 hover:shadow-red-500/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>SAYA PAHAM</span>
                    <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QRIS Modal Overlay */}
      <AnimatePresence>
        {showQrisModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[9999] flex justify-center p-4 overflow-y-auto w-full h-full"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.15 }}
              className={`relative w-full max-w-md my-auto rounded-3xl overflow-hidden border transition-all duration-300 shadow-[0_0_60px_-15px_rgba(239,68,68,0.4)] ${
                isDarkActive 
                  ? 'bg-slate-950/80 border-white/10 text-white backdrop-blur-xl' 
                  : 'bg-slate-900 border border-white/10 text-white shadow-lg'
              }`}
            >
              {/* Top Neon Accent Strip */}
              <div className="h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-600" />

              {/* Close Button X */}
              <button
                onClick={() => setShowQrisModal(false)}
                className="absolute top-5 right-5 z-50 p-2 rounded-full transition-all duration-150 cursor-pointer text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close QRIS Modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-5 md:p-8 landscape:p-4 space-y-4 md:space-y-5 landscape:space-y-2.5 text-center relative z-10 animate-none">
                {/* Header Symbol */}
                <div className="flex flex-col items-center gap-1.5 md:gap-2">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-505 font-bold shrink-0">
                    <Heart className="w-5 h-5 md:w-6 md:h-6 animate-pulse text-red-500 fill-red-500" />
                  </div>
                  <div>
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-red-400 block mb-0.5">SUPPORT...</span>
                    <h3 className="text-lg md:text-xl font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-white to-red-200">
                      Traktir Kopi...
                    </h3>
                  </div>
                </div>

                <p className="text-[11px] md:text-xs text-slate-300 max-w-sm mx-auto font-bold leading-relaxed">
                  Suport Admin biar makin semangat buat update... <br />
                  Thank you, Hooman! 🐱❤️
                </p>

                {/* QRIS Image Frame */}
                <div className="bg-white p-1 rounded-2xl max-w-[280px] sm:max-w-[320px] md:max-w-[350px] landscape:max-w-[180px] mx-auto shadow-inner border border-white/10 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300">
                  <img 
                    src={QRIS_BASE64} 
                    alt="Donate QRIS" 
                    className="w-full h-auto max-h-[35vh] landscape:max-h-[140px] rounded-xl select-none object-contain"
                  />
                </div>

                <div className="pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowQrisModal(false)}
                    className="w-full py-3 md:py-3.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all duration-200 shadow-md shadow-red-500/20 hover:shadow-red-500/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>SAYA PAHAM & TUTUP</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
