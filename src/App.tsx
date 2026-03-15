import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Plus, 
  Search, 
  Users, 
  ChevronRight, 
  Send,
  Loader2,
  FileText,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Bell,
  Calendar,
  Layout,
  Layers,
  HelpCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import { supabase } from './lib/supabase';
import { Batch, Note, Message, Profile, Notification } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Flashcard = ({ front, back }: { front: string; back: string }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  return (
    <div 
      className="perspective-1000 w-full h-64 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div 
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="relative w-full h-full preserve-3d"
      >
        <div className="absolute inset-0 backface-hidden bg-white border-2 border-[#141414] rounded-2xl p-6 flex items-center justify-center text-center shadow-lg">
          <p className="text-xl font-bold">{front}</p>
        </div>
        <div className="absolute inset-0 backface-hidden bg-[#141414] text-[#E4E3E0] border-2 border-[#141414] rounded-2xl p-6 flex items-center justify-center text-center shadow-lg rotate-y-180">
          <p className="text-xl font-medium">{back}</p>
        </div>
      </motion.div>
    </div>
  );
};

const Quiz = ({ question, options, answer, explanation }: any) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="bg-white border-2 border-[#141414] rounded-2xl p-6 shadow-lg mb-6">
      <h4 className="text-xl font-bold mb-4">{question}</h4>
      <div className="space-y-3">
        {options.map((opt: string) => (
          <button
            key={opt}
            onClick={() => setSelected(opt)}
            className={cn(
              "w-full text-left p-4 rounded-xl border-2 transition-all font-medium",
              selected === opt 
                ? (opt === answer ? "bg-emerald-100 border-emerald-500" : "bg-red-100 border-red-500")
                : "border-[#141414]/10 hover:border-[#141414]"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-4 bg-[#141414]/5 rounded-xl">
          <p className={cn("font-bold mb-2", selected === answer ? "text-emerald-600" : "text-red-600")}>
            {selected === answer ? "Correct!" : `Incorrect. The answer is ${answer}.`}
          </p>
          <p className="text-sm text-[#141414]/60">{explanation}</p>
        </motion.div>
      )}
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'chat' | 'batch-notes' | 'leaderboard'>('notes');
  const [newNote, setNewNote] = useState({ title: '', content: '', subject: '' });
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isJoiningBatch, setIsJoiningBatch] = useState(false);
  const [isRequestingNotes, setIsRequestingNotes] = useState(false);
  const [newBatchData, setNewBatchData] = useState({ name: '', university: '' });
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [noteRequestData, setNoteRequestData] = useState({ toBatchName: '', message: '' });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [batchSummary, setBatchSummary] = useState('');
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check for Supabase configuration
    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
    const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '' || supabaseAnonKey === '') {
      setConfigError('Supabase configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      const ensureProfile = async () => {
        try {
          const displayName = session.user.user_metadata?.display_name || 
                            session.user.email?.split('@')[0] || 
                            `Guest_${session.user.id.slice(0, 4)}`;
          
          await fetch('/api/auth/sync-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: session.user.id,
              displayName: displayName
            })
          });
        } catch (err) {
          console.error('Profile sync error:', err);
        }
      };
      ensureProfile();
      fetchBatches();
      fetchLeaderboard();
      fetchNotifications();
      fetchPendingRequests();
      
      // Real-time notifications
      const channel = supabase
        .channel(`user-notifications-${session.user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  useEffect(() => {
    if (selectedBatch) {
      fetchNotes(selectedBatch.id);
      fetchBatchSummary(selectedBatch.id);
      
      const channel = supabase
        .channel(`batch-notes-${selectedBatch.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `batch_id=eq.${selectedBatch.id}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotes(prev => [payload.new as Note, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setNotes(prev => prev.filter(n => n.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as Note : n));
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedBatch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAuth = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!authEmail || !authPassword) {
      alert('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Please confirm your email address before signing in.');
          }
          throw error;
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { 
            data: { display_name: authEmail.split('@')[0] },
            emailRedirectTo: window.location.origin 
          }
        });
        if (error) throw error;
        if (data?.user && data.session) {
          // User was auto-logged in (email confirmation disabled)
        } else {
          alert('Account created! Please check your email for a confirmation link to activate your account.');
        }
      }
    } catch (error: any) {
      let errorMessage = error.message || 'An error occurred during authentication.';
      
      if (errorMessage.toLowerCase().includes('rate limit')) {
        errorMessage = 'Email rate limit exceeded. Supabase limits how many authentication attempts can be made in a short time for security. Please try again in an hour, or use "Continue as Guest" to explore the app immediately.';
      } else if (errorMessage.toLowerCase().includes('email') && (errorMessage.toLowerCase().includes('send') || errorMessage.toLowerCase().includes('provider'))) {
        errorMessage = 'Error sending confirmation email. This usually happens if Supabase email limits are reached or SMTP is not configured. \n\nFIX: Go to your Supabase Dashboard > Authentication > Settings and DISABLE "Confirm Email". This will allow you to sign up without an email link.';
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        if (error.message.includes('disabled')) {
          throw new Error('Guest login is currently disabled in the backend. Please sign up with an email.');
        }
        throw error;
      }
    } catch (error: any) {
      alert(error.message || 'Guest login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setBatches([]);
    setSelectedBatch(null);
    setNotes([]);
    setMessages([]);
  };

  const fetchBatches = async () => {
    if (!session?.user?.id) return;
    try {
      const response = await fetch('/api/batches/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id })
      });
      const data = await response.json();
      
      if (response.ok && data && data.length > 0) {
        setBatches(data);
        if (!selectedBatch) setSelectedBatch(data[0]);
      }
    } catch (error) {
      console.error('Fetch batches error:', error);
    }
  };

  const handleCreateBatch = async () => {
    if (!newBatchData.name || !session) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/batches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBatchData,
          userId: session.user.id
        })
      });
      const data = await response.json();
      if (response.ok) {
        setBatches(prev => [...prev, data]);
        setSelectedBatch(data);
        setIsCreatingBatch(false);
        setNewBatchData({ name: '', university: '' });
      } else {
        alert(data.error || 'Failed to create batch');
      }
    } catch (error) {
      console.error('Create batch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinBatch = async () => {
    if (!inviteCodeInput || !session) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/batches/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCodeInput,
          userId: session.user.id
        })
      });
      const data = await response.json();
      if (response.ok) {
        setBatches(prev => {
          if (prev.find(b => b.id === data.id)) return prev;
          return [...prev, data];
        });
        setSelectedBatch(data);
        setIsJoiningBatch(false);
        setInviteCodeInput('');
      } else {
        alert(data.error || 'Failed to join batch');
      }
    } catch (error) {
      console.error('Join batch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestNotes = async () => {
    if (!noteRequestData.toBatchName || !selectedBatch || !session) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/batches/request-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromBatchId: selectedBatch.id,
          toBatchName: noteRequestData.toBatchName,
          requestedBy: session.user.id,
          message: noteRequestData.message
        })
      });
      if (response.ok) {
        alert('Request sent successfully!');
        setIsRequestingNotes(false);
        setNoteRequestData({ toBatchName: '', message: '' });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to send request');
      }
    } catch (error) {
      console.error('Request notes error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!selectedBatch) return;
    try {
      const response = await fetch(`/api/batches/requests/${selectedBatch.id}`);
      const data = await response.json();
      if (response.ok) {
        setPendingRequests(data);
      }
    } catch (error) {
      console.error('Fetch requests error:', error);
    }
  };

  const fetchNotes = async (batchId: string) => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('batch_id', batchId)
      .order('upvotes', { ascending: false });
    if (data) setNotes(data);
  };

  const fetchBatchSummary = async (batchId: string) => {
    try {
      const response = await fetch('/api/ai/batch-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const data = await response.json();
      setBatchSummary(data.summary);
    } catch (error) {
      console.error('Summary error:', error);
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('credibility_score', { ascending: false })
      .limit(10);
    if (data) setLeaderboard(data);
  };

  const fetchNotifications = async () => {
    if (!session) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
  };

  const handleVote = async (noteId: string, type: 'up' | 'down', authorId: string) => {
    try {
      await fetch('/api/notes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, type, authorId }),
      });
      // Real-time listener will update the UI
    } catch (error) {
      console.error('Vote error:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (e.g., limit to 1MB)
    if (file.size > 1024 * 1024) {
      alert('File is too large. Please upload a file smaller than 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content || content.trim() === '') {
          alert('The file appears to be empty.');
          return;
        }
        setNewNote({
          title: file.name.replace(/\.[^/.]+$/, ""),
          content: content,
          subject: 'General'
        });
        setIsAddingNote(true);
      } catch (err) {
        alert('Failed to read file content.');
      }
    };
    reader.onerror = () => {
      alert('Error reading file.');
    };
    reader.readAsText(file);
    
    // Reset input so the same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedBatch || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setActiveTab('chat');

    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: input, 
          batchId: selectedBatch.id,
          chatHistory: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.type === 'text' ? data.answer : `Generated ${data.type} based on your request.`,
        sources: data.sources,
        type: data.type,
        data: data.type !== 'text' ? JSON.parse(data.answer) : null
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNote.title || !newNote.content) {
      alert('Please provide both a title and content for your note.');
      return;
    }
    if (!selectedBatch) {
      alert('Please select a batch first.');
      return;
    }
    if (!session) {
      alert('You must be signed in to create notes.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/notes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatch.id,
          title: newNote.title,
          content: newNote.content,
          subject: newNote.subject || 'General',
          authorId: session.user.id,
          authorName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Guest'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create note');
      }

      setNewNote({ title: '', content: '', subject: '' });
      setIsAddingNote(false);
      // Refresh notes
      fetchNotes(selectedBatch.id);
    } catch (error: any) {
      console.error('Create note error:', error);
      alert(`Error creating note: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-[#141414] p-8 rounded-3xl shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] w-full max-w-md"
        >
          {configError && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-xl text-red-600 text-xs font-bold">
              ⚠️ {configError}
            </div>
          )}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-[#141414] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <BookOpen className="w-8 h-8 text-[#E4E3E0]" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">BatchMind AI</h1>
            <p className="text-sm font-bold text-[#141414]/60 uppercase tracking-widest">Academic Intelligence</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-black mb-1 block">Email Address</label>
              <input 
                type="email" 
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                className="w-full bg-[#141414]/5 border-2 border-[#141414] rounded-xl px-4 py-3 outline-none focus:bg-white transition-all font-bold"
                placeholder="student@university.edu"
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-black mb-1 block">Password</label>
              <input 
                type="password" 
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                className="w-full bg-[#141414]/5 border-2 border-[#141414] rounded-xl px-4 py-3 outline-none focus:bg-white transition-all font-bold"
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#141414] text-[#E4E3E0] py-4 rounded-xl font-black uppercase tracking-widest hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[0px] transition-all flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? 'Enter Batch' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
            {configError && (
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center mb-2">
                Note: Supabase configuration is missing or incorrect.
              </p>
            )}
            <div className="text-center space-y-1 mb-2">
              {!isLogin && (
                <p className="text-[10px] font-bold text-[#141414]/60 uppercase tracking-widest">
                  Note: Email confirmation may be required.
                </p>
              )}
              <p className="text-[10px] font-bold text-[#141414]/40 uppercase tracking-widest">
                Tip: If email fails, disable "Confirm Email" in Supabase Auth Settings.
              </p>
            </div>
            <button 
              onClick={handleGuestLogin}
              className="w-full border-2 border-[#141414] text-[#141414] py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-[#141414]/5 transition-all"
            >
              Continue as Guest
            </button>
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs font-black uppercase tracking-widest text-[#141414]/40 hover:text-[#141414] transition-colors"
            >
              {isLogin ? "New here? Sign Up" : "Already a member? Sign In"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-[#141414] text-[#E4E3E0] flex flex-col border-r border-[#141414]"
      >
        <div className="p-6 flex items-center gap-3 border-b border-[#E4E3E0]/10">
          <div className="w-8 h-8 bg-[#E4E3E0] rounded flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#141414]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">BatchMind AI</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-[#E4E3E0]/40 font-black mb-2 block px-3">
            Navigation
          </label>
          <button 
            onClick={() => setActiveTab('notes')}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 font-bold",
              activeTab === 'notes' ? "bg-[#E4E3E0] text-[#141414]" : "text-[#E4E3E0]/60 hover:bg-[#E4E3E0]/10"
            )}
          >
            <FileText className="w-5 h-5" />
            Repository
          </button>
          <button 
            onClick={() => setActiveTab('batch-notes')}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 font-bold",
              activeTab === 'batch-notes' ? "bg-[#E4E3E0] text-[#141414]" : "text-[#E4E3E0]/60 hover:bg-[#E4E3E0]/10"
            )}
          >
            <Layers className="w-5 h-5" />
            Batch Notes
          </button>
          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={cn(
              "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 font-bold",
              activeTab === 'leaderboard' ? "bg-[#E4E3E0] text-[#141414]" : "text-[#E4E3E0]/60 hover:bg-[#E4E3E0]/10"
            )}
          >
            <Trophy className="w-5 h-5" />
            Credibility Index
          </button>

          <div className="pt-6">
            <div className="flex items-center justify-between mb-3 px-3">
              <label className="text-[10px] uppercase tracking-widest text-[#E4E3E0]/40 font-black">
                Your Batches
              </label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsCreatingBatch(true)}
                  className="p-2 hover:bg-[#E4E3E0]/10 rounded-xl text-[#E4E3E0]/60 hover:text-white transition-all border border-[#E4E3E0]/10"
                  title="Create Batch"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsJoiningBatch(true)}
                  className="p-2 hover:bg-[#E4E3E0]/10 rounded-xl text-[#E4E3E0]/60 hover:text-white transition-all border border-[#E4E3E0]/10"
                  title="Join Batch"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {batches.map(batch => (
                <button
                  key={batch.id}
                  onClick={() => setSelectedBatch(batch)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl transition-all flex items-center justify-between group",
                    selectedBatch?.id === batch.id 
                      ? "bg-[#E4E3E0]/20 text-[#E4E3E0]" 
                      : "text-[#E4E3E0]/60 hover:bg-[#E4E3E0]/10"
                  )}
                >
                  <span className="truncate font-bold">{batch.name}</span>
                  <ChevronRight className={cn(
                    "w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity",
                    selectedBatch?.id === batch.id && "opacity-100"
                  )} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#E4E3E0]/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-[#141414]">
              {session?.user?.email?.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.email}</p>
              <button 
                onClick={handleLogout}
                className="text-[10px] text-[#E4E3E0]/40 uppercase tracking-wider hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-[#141414]/10 flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#141414]/5 rounded transition-colors"
            >
              <Users className="w-5 h-5" />
            </button>
            <div className="h-4 w-px bg-[#141414]/10" />
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="font-serif italic text-lg hover:text-[#141414]/60 transition-colors text-left"
            >
              {selectedBatch ? `${selectedBatch.name} Dashboard` : 'Select a Batch (Click to Open Sidebar)'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-[#141414]/5 rounded-xl transition-all relative"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-80 bg-white border-2 border-[#141414] rounded-2xl shadow-2xl z-50 p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-black uppercase text-xs tracking-widest">Notifications</h4>
                      <button onClick={() => setShowNotifications(false)}><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-[#141414]/40 text-center py-4">No new updates.</p>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className="p-3 bg-[#141414]/5 rounded-xl text-xs font-bold">
                            {n.message}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 bg-[#141414]/5 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('notes')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                activeTab === 'notes' ? "bg-white shadow-sm" : "hover:bg-white/50"
              )}
            >
              Notes
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                activeTab === 'chat' ? "bg-white shadow-sm" : "hover:bg-white/50"
              )}
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              AI Chat
            </button>
          </div>
        </div>
      </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          <AnimatePresence mode="wait">
            {activeTab === 'notes' ? (
              <motion.div 
                key="notes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col p-6 overflow-y-auto"
              >
                {!selectedBatch ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12">
                    <div className="w-24 h-24 bg-[#141414] rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl rotate-6">
                      <Users className="w-12 h-12 text-[#E4E3E0]" />
                    </div>
                    <h3 className="text-4xl font-serif italic mb-4">No Batch Selected</h3>
                    <p className="text-lg font-bold text-[#141414]/60 max-w-md uppercase tracking-tight mb-8">
                      Select a batch from the sidebar or launch a new community to start collaborating.
                    </p>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setIsCreatingBatch(true)}
                        className="bg-[#141414] text-[#E4E3E0] px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] transition-all"
                      >
                        Launch New Batch
                      </button>
                      <button 
                        onClick={() => setIsJoiningBatch(true)}
                        className="bg-white border-4 border-[#141414] text-[#141414] px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] transition-all"
                      >
                        Join Existing
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight mb-1">Batch Repository</h3>
                    <p className="text-sm text-[#141414]/60">All academic notes for this batch.</p>
                  </div>
                  <div className="flex gap-3">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".txt,.md,.js,.ts,.py,.cpp,.java,.c,.h,.css,.html,.json"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white border border-[#141414] text-[#141414] px-4 py-2 rounded flex items-center gap-2 hover:bg-[#141414]/5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Upload File
                    </button>
                    <button 
                      onClick={() => setIsAddingNote(true)}
                      className="bg-[#141414] text-[#E4E3E0] px-4 py-2 rounded flex items-center gap-2 hover:bg-[#141414]/90 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New Note
                    </button>
                  </div>
                </div>

                {isAddingNote && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 p-8 bg-white border-2 border-[#141414] rounded-3xl shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
                  >
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <input 
                        type="text"
                        placeholder="Note Title"
                        value={newNote.title}
                        onChange={e => setNewNote({ ...newNote, title: e.target.value })}
                        className="text-xl font-black outline-none border-b-2 border-[#141414]/10 focus:border-[#141414] pb-2"
                      />
                      <input 
                        type="text"
                        placeholder="Subject (e.g. Physics)"
                        value={newNote.subject}
                        onChange={e => setNewNote({ ...newNote, subject: e.target.value })}
                        className="text-xl font-black outline-none border-b-2 border-[#141414]/10 focus:border-[#141414] pb-2"
                      />
                    </div>
                    <textarea 
                      placeholder="Note Content (Markdown supported)..."
                      value={newNote.content}
                      onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                      className="w-full h-48 resize-none outline-none text-lg leading-relaxed font-medium"
                    />
                    <div className="flex justify-end gap-3 mt-6">
                      <button 
                        onClick={() => setIsAddingNote(false)}
                        className="px-6 py-2 font-black uppercase tracking-widest text-xs hover:bg-[#141414]/5 rounded-xl transition-all"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={handleCreateNote}
                        disabled={isLoading}
                        className="bg-[#141414] text-[#E4E3E0] px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:translate-y-0"
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Publishing...
                          </div>
                        ) : 'Publish Note'}
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Batch Info Card */}
                  {selectedBatch && (
                    <div className="col-span-full bg-[#141414] text-[#E4E3E0] p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 mb-2">
                      <div>
                        <h3 className="text-2xl font-serif italic mb-1">{selectedBatch.name}</h3>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-60">{selectedBatch.university}</p>
                        <div className="mt-4 flex items-center gap-4">
                          <div className="bg-white/10 px-3 py-1 rounded-lg">
                            <p className="text-[10px] uppercase tracking-tighter opacity-60">Invite Code</p>
                            <p className="font-mono font-black text-lg tracking-widest">{selectedBatch.invite_code}</p>
                          </div>
                          <button 
                            onClick={() => setIsRequestingNotes(true)}
                            className="bg-emerald-500 text-[#141414] px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] hover:translate-y-[-2px] transition-all"
                          >
                            Request Notes from Another Batch
                          </button>
                        </div>
                      </div>
                      
                      {pendingRequests.length > 0 && (
                        <div className="flex-1 max-w-md w-full">
                          <h4 className="text-[10px] uppercase tracking-widest font-black mb-3 opacity-60">Incoming Note Requests</h4>
                          <div className="space-y-2">
                            {pendingRequests.map(req => (
                              <div key={req.id} className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs">
                                <p className="font-bold mb-1">From: {req.from_batch?.name}</p>
                                <p className="opacity-60 italic">"{req.message}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {notes.map(note => (
                    <div 
                      key={note.id}
                      className="group bg-white border-2 border-[#141414] p-6 rounded-2xl hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all cursor-pointer flex flex-col h-72"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] font-black text-[#141414]">
                            {note.author_name?.slice(0, 2).toUpperCase() || '??'}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#141414]/40">
                            {note.author_name || 'Anonymous'}
                          </span>
                        </div>
                        <span className="text-[10px] font-black bg-[#141414]/5 px-2 py-1 rounded-lg">
                          {note.subject}
                        </span>
                      </div>
                      <h4 className="text-lg font-black mb-3 leading-tight">{note.title}</h4>
                      <p className="text-sm text-[#141414]/60 line-clamp-4 flex-1 font-medium">
                        {note.content}
                      </p>
                      <div className="mt-4 pt-4 border-t-2 border-[#141414]/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleVote(note.id, 'up', note.author_id); }}
                            className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                          >
                            <ThumbsUp className="w-4 h-4" />
                            <span className="text-xs font-black">{note.upvotes}</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleVote(note.id, 'down', note.author_id); }}
                            className="flex items-center gap-1 hover:text-red-600 transition-colors"
                          >
                            <ThumbsDown className="w-4 h-4" />
                            <span className="text-xs font-black">{note.downvotes}</span>
                          </button>
                        </div>
                        <span className="text-[10px] font-black text-[#141414]/40">
                          {new Date(note.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
            ) : activeTab === 'batch-notes' ? (
              <motion.div 
                key="batch-notes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 p-8 overflow-y-auto"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-[#141414] rounded-2xl flex items-center justify-center shadow-lg">
                      <Layers className="w-6 h-6 text-[#E4E3E0]" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black tracking-tighter uppercase">Batch Summary</h3>
                      <p className="text-sm font-bold text-[#141414]/60 uppercase tracking-widest">AI-Organized Intelligence</p>
                    </div>
                  </div>
                  <div className="bg-white border-2 border-[#141414] rounded-3xl p-8 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]">
                    <div className="prose prose-lg max-w-none font-medium">
                      <ReactMarkdown>{batchSummary || "Generating summary from batch repository..."}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'leaderboard' ? (
              <motion.div 
                key="leaderboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 p-8 overflow-y-auto"
              >
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg border-2 border-[#141414]">
                      <Trophy className="w-6 h-6 text-[#141414]" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black tracking-tighter uppercase">Credibility Index</h3>
                      <p className="text-sm font-bold text-[#141414]/60 uppercase tracking-widest">Top Contributors</p>
                    </div>
                  </div>
                  <div className="bg-white border-2 border-[#141414] rounded-3xl overflow-hidden shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]">
                    {leaderboard.map((profile, i) => (
                      <div 
                        key={profile.id}
                        className={cn(
                          "flex items-center justify-between p-6 border-b-2 border-[#141414]/5 last:border-0",
                          i === 0 ? "bg-yellow-50" : ""
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-black text-[#141414]/20 w-8">#{i + 1}</span>
                          <div className="w-10 h-10 rounded-full bg-[#141414] flex items-center justify-center text-xs font-black text-[#E4E3E0]">
                            {profile.display_name?.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-lg font-black">{profile.display_name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xl font-black">{profile.credibility_score}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#141414]/40">Points</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col bg-white"
              >
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12">
                      <div className="w-20 h-20 bg-[#141414] rounded-3xl flex items-center justify-center mb-6 shadow-2xl rotate-3">
                        <Sparkles className="w-10 h-10 text-[#E4E3E0]" />
                      </div>
                      <h3 className="text-3xl font-black tracking-tighter uppercase mb-2">Grounded Batch AI</h3>
                      <p className="text-lg font-bold text-[#141414]/60 max-w-md uppercase tracking-tight">
                        Ask for summaries, flashcards, or quizzes for any subject.
                      </p>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "flex flex-col max-w-3xl w-full",
                        msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "p-6 rounded-3xl text-lg font-medium shadow-sm",
                        msg.role === 'user' 
                          ? "bg-[#141414] text-[#E4E3E0] rounded-tr-none" 
                          : "bg-[#E4E3E0]/30 text-[#141414] border-2 border-[#141414] rounded-tl-none"
                      )}>
                        {msg.type === 'text' ? (
                          <div className="markdown-body prose prose-sm max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : msg.type === 'flashcards' ? (
                          <div className="grid grid-cols-1 gap-4 w-full min-w-[300px]">
                            {msg.data.map((card: any, idx: number) => (
                              <Flashcard key={idx} front={card.front} back={card.back} />
                            ))}
                          </div>
                        ) : msg.type === 'quiz' ? (
                          <div className="w-full min-w-[300px]">
                            {msg.data.map((q: any, idx: number) => (
                              <Quiz key={idx} {...q} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {msg.sources.map(source => (
                            <span key={source.id} className="text-[10px] font-black uppercase tracking-widest bg-[#141414] text-white px-3 py-1.5 rounded-full flex items-center gap-2">
                              <FileText className="w-3 h-3" />
                              {source.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-3 text-[#141414]/40">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium animate-pulse">Consulting batch repository...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 border-t-2 border-[#141414]/10">
                  <div className="max-w-3xl mx-auto relative">
                    <input 
                      type="text"
                      placeholder="Ask for summaries, flashcards, or quizzes..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                      className="w-full bg-[#141414]/5 border-2 border-[#141414] rounded-2xl px-6 py-5 pr-16 outline-none focus:bg-white transition-all text-lg font-bold"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={isLoading || !input.trim()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#141414] text-[#E4E3E0] rounded-xl flex items-center justify-center hover:translate-y-[-52%] transition-all disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isCreatingBatch && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-md rounded-3xl p-8 shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-serif italic">Create New Batch</h2>
                <button onClick={() => setIsCreatingBatch(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black mb-2 block">Batch Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., CS 101 - Fall 2024"
                    value={newBatchData.name}
                    onChange={e => setNewBatchData({ ...newBatchData, name: e.target.value })}
                    className="w-full bg-white border-2 border-[#141414] rounded-xl px-4 py-3 outline-none focus:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black mb-2 block">University / Institution</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Stanford University"
                    value={newBatchData.university}
                    onChange={e => setNewBatchData({ ...newBatchData, university: e.target.value })}
                    className="w-full bg-white border-2 border-[#141414] rounded-xl px-4 py-3 outline-none focus:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all font-bold"
                  />
                </div>
                <button 
                  onClick={handleCreateBatch}
                  disabled={isLoading || !newBatchData.name}
                  className="w-full bg-[#141414] text-[#E4E3E0] py-4 rounded-xl font-black uppercase tracking-widest hover:translate-y-[-2px] transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Launch Batch'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isJoiningBatch && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-md rounded-3xl p-8 shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-serif italic">Join a Batch</h2>
                <button onClick={() => setIsJoiningBatch(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black mb-2 block">Invite Code</label>
                  <input 
                    type="text" 
                    placeholder="ENTER 6-DIGIT CODE"
                    value={inviteCodeInput}
                    onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                    className="w-full bg-white border-2 border-[#141414] rounded-xl px-4 py-3 outline-none focus:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all font-bold text-center text-2xl tracking-[0.5em]"
                    maxLength={6}
                  />
                </div>
                <button 
                  onClick={handleJoinBatch}
                  disabled={isLoading || inviteCodeInput.length < 6}
                  className="w-full bg-[#141414] text-[#E4E3E0] py-4 rounded-xl font-black uppercase tracking-widest hover:translate-y-[-2px] transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Joining...' : 'Enter Batch'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isRequestingNotes && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-md rounded-3xl p-8 shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-serif italic">Request Notes</h2>
                <button onClick={() => setIsRequestingNotes(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black mb-2 block">Target Batch Name</label>
                  <input 
                    type="text" 
                    placeholder="Exact name of the other batch"
                    value={noteRequestData.toBatchName}
                    onChange={e => setNoteRequestData({ ...noteRequestData, toBatchName: e.target.value })}
                    className="w-full bg-white border-2 border-[#141414] rounded-xl px-4 py-3 outline-none focus:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black mb-2 block">Message / Topic</label>
                  <textarea 
                    placeholder="What notes do you need? (e.g., Week 5 Calculus)"
                    value={noteRequestData.message}
                    onChange={e => setNoteRequestData({ ...noteRequestData, message: e.target.value })}
                    className="w-full bg-white border-2 border-[#141414] rounded-xl px-4 py-3 outline-none focus:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all font-bold h-24 resize-none"
                  />
                </div>
                <button 
                  onClick={handleRequestNotes}
                  disabled={isLoading || !noteRequestData.toBatchName}
                  className="w-full bg-[#141414] text-[#E4E3E0] py-4 rounded-xl font-black uppercase tracking-widest hover:translate-y-[-2px] transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
