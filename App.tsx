import React, { useState, useMemo } from 'react';
import { 
  Search, 
  FileText, 
  Calendar, 
  Layers, 
  Plus, 
  Download, 
  ChevronRight, 
  AlertCircle, 
  ArrowRight,
  Loader2,
  Trash2,
  FileUp,
  Settings,
  User,
  Activity,
  ShieldAlert,
  Zap,
  Info,
  Upload,
  History,
  SearchCode,
  List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import ReactMarkdown from 'react-markdown';
import { 
  analyzeDocuments, 
  generateComparison,
  AnalysisResult, 
  TimelineEvent, 
  CategorizedDocument, 
  DocumentCategory,
  AnalysisContext,
  ChartData
} from './services/gemini';
import { format, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { parseFile, generateHash } from './lib/fileParser';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';

import { Slider } from '@/components/ui/slider';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Palette, 
  Type as TypeIcon, 
  Layout, 
  FilePlus, 
  Save, 
  Edit3,
  Check,
  X
} from 'lucide-react';

const MAX_TOTAL_SIZE_MB = 100;
const MAX_SINGLE_SIZE_MB = 20;
const MAX_ZIP_SIZE_MB = 40;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;
const MAX_SINGLE_SIZE_BYTES = MAX_SINGLE_SIZE_MB * 1024 * 1024;
const MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024;

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

const FIELDS = [
  'Insurance (Home & Auto)',
  'Healthcare',
  'Finance & Banking',
  'Real Estate',
  'Mortgage (RESPA/TILA)',
  'Employment Law',
  'Corporate Governance',
  'Environmental',
  'Intellectual Property'
];

const LAW_TYPES = [
  { id: 'federal', label: 'Federal Laws' },
  { id: 'state', label: 'State Statutes' },
  { id: 'regulatory', label: 'Regulatory Guidelines' },
  { id: 'case-law', label: 'Case Law/Precedents' },
  { id: 'internal', label: 'Internal Policies' }
];

const THEMES = [
  { id: 'professional', name: 'Professional Blue', primary: '#2563eb', secondary: '#1e293b' },
  { id: 'emerald', name: 'Emerald Legal', primary: '#059669', secondary: '#064e3b' },
  { id: 'slate', name: 'Modern Slate', primary: '#475569', secondary: '#0f172a' },
  { id: 'crimson', name: 'Executive Crimson', primary: '#991b1b', secondary: '#450a0a' },
];

const PAGE_TEMPLATES = [
  { id: 'cover', name: 'Cover Letter', icon: FileText },
  { id: 'toc', name: 'Table of Contents', icon: List },
  { id: 'index', name: 'Index', icon: SearchCode },
  { id: 'attachments', name: 'Attachments List', icon: Layers },
  { id: 'ending', name: 'Conclusion', icon: Check },
  { id: 'blank', name: 'Blank Page', icon: Plus },
];

const TIMELINE_CATEGORIES = [
  'Claims Handling',
  'Premium/Billing',
  'Underwriting',
  'Regulatory/Compliance',
  'Legal/Litigation',
  'Communication',
  'Internal Review'
];

const CATEGORY_COLORS: Record<string, string> = {
  'Claims Handling': 'bg-blue-100 text-blue-700 border-blue-200',
  'Premium/Billing': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Underwriting': 'bg-amber-100 text-amber-700 border-amber-200',
  'Regulatory/Compliance': 'bg-purple-100 text-purple-700 border-purple-200',
  'Legal/Litigation': 'bg-red-100 text-red-700 border-red-200',
  'Communication': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Internal Review': 'bg-slate-100 text-slate-700 border-slate-200'
};

export interface CustomPage {
  id: string;
  title: string;
  content: string;
  templateId: string;
}

export default function App() {
  const [documents, setDocuments] = useState<CategorizedDocument[]>([]);
  const [newDoc, setNewDoc] = useState('');
  const [currentCategory, setCurrentCategory] = useState<DocumentCategory>('PRIMARY');
  const [deepMetadata, setDeepMetadata] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{ name: string; error: string }[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<{ index: number, event: TimelineEvent } | null>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [excludedCharts, setExcludedCharts] = useState<number[]>([]);
  const [editingChart, setEditingChart] = useState<{ index: number, chart: ChartData } | null>(null);

  // Customization State
  const [headerFontSize, setHeaderFontSize] = useState(24);
  const [activeTheme, setActiveTheme] = useState(THEMES[0]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedReport, setEditedReport] = useState('');
  const [isEditingRecs, setIsEditingRecs] = useState(false);
  const [editedRecs, setEditedRecs] = useState<string[]>([]);
  const [focusExplanation, setFocusExplanation] = useState('');

  // Comparison State
  const [comparisonItemA, setComparisonItemA] = useState('');
  const [comparisonItemB, setComparisonItemB] = useState('');
  const [comparisonResult, setComparisonResult] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [includeIndexInReport, setIncludeIndexInReport] = useState(false);

  // Analysis Setup State
  const [context, setContext] = useState<AnalysisContext>({
    state: 'Washington',
    field: 'Insurance (Home & Auto)',
    lawTypes: ['state', 'regulatory'],
    specificLaws: 'IFCA (Insurance Fair Conduct Act), CPA (Consumer Protection Act), RCW 48.30, WAC 284-30',
    additionalContext: 'Focusing on bad faith practices and claims handling guidelines in WA state.',
    adminName: 'Admin_01',
    caseRefs: [{ label: 'Case Ref', value: '2024-XA-992' }]
  });

  const totalSizeBytes = useMemo(() => {
    return documents.reduce((acc, doc) => acc + doc.size, 0);
  }, [documents]);

  const addCustomPage = (templateId: string) => {
    const template = PAGE_TEMPLATES.find(t => t.id === templateId);
    let initialContent = '';
    
    switch(templateId) {
      case 'cover':
        initialContent = `# Cover Letter\n\nDate: ${new Date().toLocaleDateString()}\n\nTo: [Recipient Name]\nFrom: ${context.adminName || '[Your Name]'}\n\nSubject: Analysis Report - ${context.field}\n\nDear [Recipient],\n\nPlease find the attached report regarding the analysis of ${context.caseRefs?.map(r => `${r.label} ${r.value}`).join(', ') || 'the case'}.\n\nThis analysis focuses on ${context.additionalContext}.`;
        break;
      case 'ending':
        initialContent = `# Conclusion\n\nThis report concludes the analysis of the provided documentation for ${context.caseRefs?.map(r => `${r.label} ${r.value}`).join(', ') || 'the case'}.\n\nBased on the findings, we recommend ${result?.recommendations.slice(0, 2).join(' and ') || 'further review'}.\n\nSincerely,\n\n${context.adminName || '[Your Name]'}`;
        break;
      case 'index':
        initialContent = `# Index\n\n${result?.categories.map(c => `- ${c.category}: ${c.summary.substring(0, 50)}...`).join('\n') || '- Theme A: Page X'}`;
        break;
      case 'toc':
        initialContent = `# Table of Contents\n\n1. Executive Summary\n2. Thematic Analysis\n3. Legal Implications\n4. Recommendations\n5. Attachments\n6. Intelligence Reports\n7. Action Steps`;
        break;
      case 'attachments':
        initialContent = `# Attachments & Evidence List\n\n${result?.attachments.map((a, i) => `${i+1}. ${a}`).join('\n') || 'No attachments identified yet.'}`;
        break;
      case 'blank':
        initialContent = '';
        break;
      default:
        initialContent = `# ${template?.name}\n\nEnter your free-form data here...`;
    }

    const newPage: CustomPage = {
      id: Math.random().toString(36).substr(2, 9),
      title: template?.name || 'New Page',
      content: initialContent,
      templateId
    };
    setCustomPages([...customPages, newPage]);
    setActiveTab(`page-${newPage.id}`);
  };

  const updatePageContent = (id: string, content: string) => {
    setCustomPages(customPages.map(p => p.id === id ? { ...p, content } : p));
  };

  const updatePageTitle = (id: string, title: string) => {
    setCustomPages(customPages.map(p => p.id === id ? { ...p, title } : p));
  };

  const deletePage = (id: string) => {
    setCustomPages(customPages.filter(p => p.id !== id));
    setActiveTab('dashboard');
  };

  const remainingMB = useMemo(() => {
    const remaining = MAX_TOTAL_SIZE_BYTES - totalSizeBytes;
    return Math.max(0, remaining / (1024 * 1024)).toFixed(2);
  }, [totalSizeBytes]);

  const handleAddCaseRef = () => {
    setContext({
      ...context,
      caseRefs: [...(context.caseRefs || []), { label: '', value: '' }]
    });
  };

  const handleRemoveCaseRef = (index: number) => {
    setContext({
      ...context,
      caseRefs: (context.caseRefs || []).filter((_, i) => i !== index)
    });
  };

  const handleUpdateCaseRef = (index: number, field: 'label' | 'value', value: string) => {
    const newRefs = [...(context.caseRefs || [])];
    newRefs[index] = { ...newRefs[index], [field]: value };
    setContext({ ...context, caseRefs: newRefs });
  };

  const handleUpdateEvent = () => {
    if (editingEvent && result) {
      const newEvents = [...result.events];
      newEvents[editingEvent.index] = editingEvent.event;
      
      // Re-map categories
      const newCategories = result.categories.map(cat => ({
        ...cat,
        events: newEvents.filter(e => e.category === cat.category)
      }));

      setResult({ ...result, events: newEvents, categories: newCategories });
      setEditingEvent(null);
    }
  };

  const handleDeleteEvent = (index: number) => {
    if (result) {
      const newEvents = result.events.filter((_, i) => i !== index);
      const newCategories = result.categories.map(cat => ({
        ...cat,
        events: newEvents.filter(e => e.category === cat.category)
      }));
      setResult({ ...result, events: newEvents, categories: newCategories });
    }
  };

  const handleAddEvent = (event: TimelineEvent) => {
    if (result) {
      const newEvents = [...result.events, event].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Check if category exists in result.categories, if not add it
      let newCategories = [...result.categories];
      if (!newCategories.find(c => c.category === event.category)) {
        newCategories.push({
          category: event.category,
          summary: `User added category: ${event.category}`,
          events: []
        });
      }

      newCategories = newCategories.map(cat => ({
        ...cat,
        events: newEvents.filter(e => e.category === cat.category)
      }));

      setResult({ ...result, events: newEvents, categories: newCategories });
      setIsAddingEvent(false);
    }
  };

  const impactfulCategories = useMemo(() => {
    if (!result) return [];
    return [...result.categories]
      .sort((a, b) => b.events.length - a.events.length)
      .slice(0, 3);
  }, [result]);

  const handleAddDoc = async () => {
    if (newDoc.trim()) {
      const contentBlob = new Blob([newDoc]);
      const size = contentBlob.size;
      if (size > MAX_SINGLE_SIZE_BYTES) {
        alert(`This document exceeds the ${MAX_SINGLE_SIZE_MB}MB single document limit.`);
        return;
      }
      if (totalSizeBytes + size > MAX_TOTAL_SIZE_BYTES) {
        alert(`Adding this document would exceed the ${MAX_TOTAL_SIZE_MB}MB total limit.`);
        return;
      }
      const hash = await generateHash(contentBlob);
      setDocuments([...documents, {
        content: newDoc,
        category: currentCategory,
        name: `Manual Entry (${new Date().toLocaleTimeString()})`,
        size,
        deepMetadataAnalysis: deepMetadata,
        hash
      }]);
      setNewDoc('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadErrors([]);
    
    if (files.length > 20) {
      setUploadErrors([{ name: "Batch Limit", error: "You can only upload up to 20 documents at a time." }]);
      e.target.value = '';
      return;
    }

    // Check same extension for multiples
    if (files.length > 1) {
      const firstExt = files[0].name.split('.').pop()?.toLowerCase();
      for (let i = 1; i < files.length; i++) {
        const currentExt = files[i].name.split('.').pop()?.toLowerCase();
        if (currentExt !== firstExt) {
          setUploadErrors([{ name: "Extension Mismatch", error: "When uploading multiple documents, they must all have the same file extension." }]);
          e.target.value = '';
          return;
        }
      }
    }

    setIsParsing(true);
    const currentErrors: { name: string; error: string }[] = [];
    const newDocs: CategorizedDocument[] = [];
    let currentBatchSize = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          if (file.size > MAX_SINGLE_SIZE_BYTES && !file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
            throw new Error(`Exceeds ${MAX_SINGLE_SIZE_MB}MB limit`);
          }
          if ((file.name.endsWith('.zip') || file.name.endsWith('.tar.gz')) && file.size > MAX_ZIP_SIZE_BYTES) {
            throw new Error(`Archive exceeds ${MAX_ZIP_SIZE_MB}MB limit`);
          }
          if (totalSizeBytes + currentBatchSize + file.size > MAX_TOTAL_SIZE_BYTES) {
            throw new Error(`Exceeds total ${MAX_TOTAL_SIZE_MB}MB limit`);
          }
          
          const parsedFiles = await parseFile(file, file.name, deepMetadata);
          for (const parsed of parsedFiles) {
            newDocs.push({
              content: parsed.content,
              category: currentCategory,
              name: parsed.name,
              size: parsed.size,
              deepMetadataAnalysis: deepMetadata,
              type: parsed.type,
              hash: parsed.hash,
              pageCount: parsed.pageCount
            });
            currentBatchSize += parsed.size;
          }
        } catch (err) {
          console.error(`Failed to parse ${file.name}:`, err);
          currentErrors.push({
            name: file.name,
            error: err instanceof Error ? err.message : "Unknown error"
          });
        }
      }
      
      if (newDocs.length > 0) {
        setDocuments(prev => [...prev, ...newDocs]);
      }
      
      if (currentErrors.length > 0) {
        setUploadErrors(prev => [...prev, ...currentErrors]);
      }
    } catch (error) {
      console.error("Batch upload failed:", error);
      setUploadErrors(prev => [...prev, { name: "System", error: "An unexpected error occurred during upload." }]);
    } finally {
      setIsParsing(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleRemoveDoc = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (documents.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const analysis = await analyzeDocuments(documents, context, focusExplanation);
      setResult(analysis);
      setEditedReport(analysis.masterReport);
      setEditedRecs(analysis.recommendations);
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysisError(error instanceof Error ? error.message : "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleComparison = async () => {
    if (!comparisonItemA || !comparisonItemB) return;
    setIsComparing(true);
    try {
      const comparison = await generateComparison(comparisonItemA, comparisonItemB, context);
      setComparisonResult(comparison);
    } catch (error) {
      console.error("Comparison failed:", error);
    } finally {
      setIsComparing(false);
    }
  };

  const filteredEvents = useMemo(() => {
    if (!result) return [];
    return result.events.filter(event => 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.subCategory.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });
  }, [result, searchQuery]);

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return isValid(date) ? format(date, 'MMM d, yyyy') : dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] text-[#0f172a] font-sans">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#1e293b] text-white flex flex-col p-6 shrink-0 h-screen sticky top-0 hidden md:flex">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 bg-[#2563eb] rounded-sm flex items-center justify-center">
            <Layers className="text-white w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CaseNexus</h1>
        </div>

        <nav className="space-y-6 flex-1">
          <div>
            <h3 className="text-[11px] uppercase tracking-widest text-[#94a3b8] font-bold mb-3">Master Repository</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2 bg-white/10 rounded-md text-sm font-medium cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  All Documents
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white text-[10px] h-5 px-1.5">{documents.length}</Badge>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer ${activeTab === 'setup' ? 'bg-white/10 text-white rounded-md' : ''}`} onClick={() => setActiveTab('setup')}>
                <Settings className="w-4 h-4" />
                Analysis Setup
              </div>
              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="flex items-center justify-between px-3 mb-4">
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Custom Pages</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6 text-[#94a3b8] hover:text-white" />}>
                      <Plus className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {PAGE_TEMPLATES.map(t => (
                        <DropdownMenuItem key={t.id} onClick={() => addCustomPage(t.id)}>
                          <t.icon className="w-4 h-4 mr-2" />
                          {t.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1">
                  {customPages.map(page => (
                    <div 
                      key={page.id}
                      className={`flex items-center justify-between group px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer ${activeTab === `page-${page.id}` ? 'bg-white/10 text-white rounded-md' : ''}`}
                      onClick={() => setActiveTab(`page-${page.id}`)}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </div>
                      <Trash2 
                        className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity" 
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePage(page.id);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer">
                <Calendar className="w-4 h-4" />
                Case Timeline
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-widest text-[#94a3b8] font-bold mb-3">Intelligence</h3>
            <div className="space-y-1">
              <div 
                className={`flex items-center gap-2 px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer ${activeTab === 'intelligence-research' ? 'bg-white/10 text-white rounded-md' : ''}`}
                onClick={() => setActiveTab('intelligence-research')}
              >
                <Layers className="w-4 h-4" />
                Research Reports
              </div>
              <div 
                className={`flex items-center gap-2 px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer ${activeTab === 'intelligence-legal' ? 'bg-white/10 text-white rounded-md' : ''}`}
                onClick={() => setActiveTab('intelligence-legal')}
              >
                <ShieldAlert className="w-4 h-4" />
                Legal Analysis
              </div>
              <div 
                className={`flex items-center justify-between px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer ${activeTab === 'intelligence-action' ? 'bg-white/10 text-white rounded-md' : ''}`}
                onClick={() => setActiveTab('intelligence-action')}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Action Steps
                </div>
                {result?.intelligence.actionSteps.some(s => s.priority === 'high') && (
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                )}
              </div>
            </div>
          </div>
        </nav>

        <div className="pt-6 border-t border-white/10 space-y-1">
          <div 
            className={`flex items-center gap-2 px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer ${activeTab === 'settings' ? 'bg-white/10 text-white rounded-md' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings className="w-4 h-4" />
            Settings
          </div>
          <div 
            className={`flex items-center gap-2 px-3 py-2 text-[#94a3b8] hover:text-white transition-colors text-sm cursor-pointer ${activeTab === 'setup' ? 'bg-white/10 text-white rounded-md' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            <User className="w-4 h-4" />
            {context.adminName || 'Admin_01'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">
        {/* Header */}
        <header className="h-16 bg-white border-b border-[#e2e8f0] flex items-center justify-between px-8 shrink-0 sticky top-0 z-50">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">Project: Master Analysis Dashboard</h2>
            <p className="text-[12px] text-[#64748b]">Case Ref: {result ? '2024-XA-992' : 'Pending Analysis'}</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <Input 
                placeholder="Search timeline, events, or legal citations..." 
                className="pl-9 w-[320px] bg-[#f8fafc] border-[#e2e8f0] rounded-full text-[13px] h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-9 px-4 text-[12px] font-semibold border-[#cbd5e1] hover:bg-[#f8fafc]">
                Export PDF
              </Button>
              <Dialog>
                <DialogTrigger render={<Button className="h-9 px-4 text-[12px] font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8]" />}>
                  Generate Report
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>Add Research & Reports</DialogTitle>
                    <DialogDescription>
                      Upload files or paste text. Categorize them to provide context for the analysis.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Document Category</Label>
                        <Select value={currentCategory} onValueChange={(v) => setCurrentCategory(v as DocumentCategory)}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRIMARY">
                              <div className="flex items-center gap-2">
                                <SearchCode className="w-4 h-4 text-blue-500" />
                                <span>Primary Analysis Material</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="RESEARCH">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span>Existing Research/Analysis</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="BACKGROUND">
                              <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-slate-500" />
                                <span>Background/Historical Data</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Upload Files</Label>
                        <div className="relative">
                          <Input 
                            type="file" 
                            multiple 
                            className="hidden" 
                            id="file-upload" 
                            onChange={handleFileUpload}
                            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.eml,.msg,.odt,.ott,.odf,.js,.json,.png,.jpg,.jpeg,.tiff,.zip,.gz"
                          />
                          <Button 
                            type="button"
                            variant="outline" 
                            className="w-full bg-white border-dashed border-2 h-10"
                            onClick={() => document.getElementById('file-upload')?.click()}
                            disabled={isParsing}
                          >
                            {isParsing ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {isParsing ? 'Parsing...' : 'PDF, Word, Excel, Images'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-2">
                      <Label htmlFor="doc-content">Manual Text Entry</Label>
                      <Textarea 
                        id="doc-content" 
                        placeholder="Paste text here..." 
                        className="min-h-[120px] bg-white"
                        value={newDoc}
                        onChange={(e) => setNewDoc(e.target.value)}
                      />
                      <Button type="button" onClick={handleAddDoc} variant="secondary" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Text to Queue
                      </Button>
                      
                      {uploadErrors.length > 0 && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Upload Error Report</span>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => setUploadErrors([])}>
                              Clear
                            </Button>
                          </div>
                          <div className="space-y-1 max-h-[100px] overflow-auto">
                            {uploadErrors.map((err, i) => (
                              <div key={i} className="text-[11px] text-red-600 flex items-start gap-2">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                <span><span className="font-bold">{err.name}:</span> {err.error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="focus-explanation">Focus Explanation (Optional)</Label>
                      <Textarea 
                        id="focus-explanation" 
                        placeholder="Explain the content and what the AI should specifically focus on for this analysis..." 
                        className="min-h-[80px] bg-white"
                        value={focusExplanation}
                        onChange={(e) => setFocusExplanation(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-[11px] uppercase tracking-widest text-[#64748b] font-bold">
                          Analysis Queue ({documents.length} items)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 font-bold uppercase tracking-wider"
                            onClick={() => setDocuments([])}
                          >
                            Clear Queue
                          </Button>
                          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Remaining Space:</span>
                          <Badge variant={Number(remainingMB) < 5 ? "destructive" : "outline"} className="text-[10px] font-bold">
                            {remainingMB} MB
                          </Badge>
                        </div>
                      </div>
                      <ScrollArea className="h-[200px] rounded-xl border border-[#e2e8f0] p-2 bg-[#f8fafc]">
                        {documents.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-[#94a3b8] text-sm italic">
                            Queue is empty. Add documents above.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {documents.map((doc, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e2e8f0] group shadow-sm">
                                <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[9px] font-bold uppercase tracking-tighter h-4 px-1 border-none ${
                                        doc.category === 'PRIMARY' ? 'bg-blue-100 text-blue-700' :
                                        doc.category === 'RESEARCH' ? 'bg-amber-100 text-amber-700' :
                                        'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {doc.category}
                                    </Badge>
                                    <span className="text-[13px] font-bold truncate text-[#1e293b]">{doc.name}</span>
                                  </div>
                                  <span className="text-[11px] text-[#64748b] truncate">{doc.content.substring(0, 100)}...</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveDoc(i)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 pt-2">
                    {analysisError && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{analysisError}</p>
                      </div>
                    )}
                    <Button 
                      onClick={handleAnalyze} 
                      disabled={documents.length === 0 || isAnalyzing || isParsing}
                      className="w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8] h-12 text-lg font-bold shadow-lg shadow-blue-500/20"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Running Intelligence Analysis...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          Start Master Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* Timeline Container */}
        {result && (
          <section className="h-[140px] bg-white border-b border-[#e2e8f0] px-8 py-5 shrink-0">
            <div className="text-[12px] uppercase font-bold text-[#64748b] mb-4 tracking-wider">Master Incident Timeline</div>
            <div className="relative h-1 bg-[#e2e8f0] mt-10 rounded-full mx-4">
              {result.events.slice(0, 5).map((event, i, arr) => {
                const left = arr.length > 1 ? (i / (arr.length - 1)) * 100 : 50;
                return (
                  <div key={i} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
                    <div className={`rounded-full bg-white border-[3px] -translate-x-1/2 cursor-pointer hover:scale-125 transition-transform ${
                      event.importance === 'high' 
                        ? 'w-4 h-4 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' 
                        : 'w-3 h-3 border-[#2563eb]'
                    }`} />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 text-center">
                      <div className="text-[11px] font-bold leading-tight truncate">{event.title}</div>
                    </div>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 text-center">
                      <div className="text-[10px] text-[#64748b] font-medium">{formatDate(event.date)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Content Area */}
        <div className="flex-1 p-5">
          {!result && !isAnalyzing ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-white border border-[#e2e8f0] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <FileText className="w-10 h-10 text-[#2563eb]" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">No analysis data yet</h2>
              <p className="text-[#64748b] mb-8 text-lg">
                Upload your research, reports, and documents to generate a master timeline, 
                thematic groupings, and a comprehensive research report.
              </p>
              <Dialog>
                <DialogTrigger render={<Button size="lg" className="bg-[#2563eb] text-white px-8 h-12 rounded-full text-lg hover:scale-105 transition-transform shadow-lg shadow-blue-500/20" />}>
                  <span>
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5 inline-block" />
                  </span>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>Add Research & Reports</DialogTitle>
                    <DialogDescription>
                      Upload files or paste text. Categorize them to provide context for the analysis.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Document Category</Label>
                        <Select value={currentCategory} onValueChange={(v) => setCurrentCategory(v as DocumentCategory)}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRIMARY">
                              <div className="flex items-center gap-2">
                                <SearchCode className="w-4 h-4 text-blue-500" />
                                <span>Primary Analysis Material</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="RESEARCH">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span>Existing Research/Analysis</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="BACKGROUND">
                              <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-slate-500" />
                                <span>Background/Historical Data</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Upload Files</Label>
                        <div className="relative">
                          <Input 
                            type="file" 
                            multiple 
                            className="hidden" 
                            id="file-upload-start" 
                            onChange={handleFileUpload}
                            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.eml,.msg,.odt,.ott,.odf,.js,.json,.png,.jpg,.jpeg,.tiff,.zip,.gz"
                          />
                          <Button 
                            type="button"
                            variant="outline" 
                            className="w-full bg-white border-dashed border-2 h-10"
                            onClick={() => document.getElementById('file-upload-start')?.click()}
                            disabled={isParsing}
                          >
                            {isParsing ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {isParsing ? 'Parsing...' : 'PDF, Word, Excel, Images'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                      <Checkbox 
                        id="deep-metadata" 
                        checked={deepMetadata} 
                        onCheckedChange={(checked) => setDeepMetadata(!!checked)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="deep-metadata"
                          className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                          <ShieldAlert className="w-4 h-4 text-blue-600" />
                          Deep Metadata Analysis
                        </label>
                        <p className="text-[11px] text-[#64748b]">
                          Analyze PDF metadata for anomalies and Email headers for inaccuracies/spoofing.
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-2">
                      <Label htmlFor="doc-content-start">Manual Text Entry</Label>
                      <Textarea 
                        id="doc-content-start" 
                        placeholder="Paste text here..." 
                        className="min-h-[150px] bg-white"
                        value={newDoc}
                        onChange={(e) => setNewDoc(e.target.value)}
                      />
                      <Button type="button" onClick={handleAddDoc} variant="secondary" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Text to Queue
                      </Button>

                      {uploadErrors.length > 0 && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Upload Error Report</span>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => setUploadErrors([])}>
                              Clear
                            </Button>
                          </div>
                          <div className="space-y-1 max-h-[100px] overflow-auto">
                            {uploadErrors.map((err, i) => (
                              <div key={i} className="text-[11px] text-red-600 flex items-start gap-2">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                <span><span className="font-bold">{err.name}:</span> {err.error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-[11px] uppercase tracking-widest text-[#64748b] font-bold">
                          Analysis Queue ({documents.length} items)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 font-bold uppercase tracking-wider"
                            onClick={() => setDocuments([])}
                          >
                            Clear Queue
                          </Button>
                          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Remaining Space:</span>
                          <Badge variant={Number(remainingMB) < 5 ? "destructive" : "outline"} className="text-[10px] font-bold">
                            {remainingMB} MB
                          </Badge>
                        </div>
                      </div>
                      <ScrollArea className="h-[200px] rounded-xl border border-[#e2e8f0] p-2 bg-[#f8fafc]">
                        {documents.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-[#94a3b8] text-sm italic">
                            Queue is empty. Add documents above.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {documents.map((doc, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e2e8f0] group shadow-sm">
                                <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[9px] font-bold uppercase tracking-tighter h-4 px-1 border-none ${
                                        doc.category === 'PRIMARY' ? 'bg-blue-100 text-blue-700' :
                                        doc.category === 'RESEARCH' ? 'bg-amber-100 text-amber-700' :
                                        'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {doc.category}
                                    </Badge>
                                    <span className="text-[13px] font-bold truncate text-[#1e293b]">{doc.name}</span>
                                  </div>
                                  <span className="text-[11px] text-[#64748b] truncate">{doc.content.substring(0, 100)}...</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveDoc(i)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 pt-2">
                    {analysisError && (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{analysisError}</p>
                      </div>
                    )}
                    <Button 
                      onClick={handleAnalyze} 
                      disabled={documents.length === 0 || isAnalyzing || isParsing}
                      className="w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8] h-12 text-lg font-bold shadow-lg shadow-blue-500/20"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Running Intelligence Analysis...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          Start Master Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[#2563eb]/20 border-t-[#2563eb] rounded-full animate-spin mb-6" />
                <Layers className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-[#2563eb] -mt-3" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Processing Documents</h2>
              <p className="text-[#64748b]">Gemini is analyzing themes, extracting dates, and drafting your report...</p>
            </div>
          ) : (
            <div className="h-full flex flex-col gap-5">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <TabsList className="bg-[#e2e8f0] p-1 rounded-lg h-10">
                    <TabsTrigger value="dashboard" className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b]">
                      Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="charts" className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b]">
                      Charts
                    </TabsTrigger>
                    {customPages.map(page => (
                      <TabsTrigger key={page.id} value={`page-${page.id}`} className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b]">
                        {page.title}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="setup" className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b]">
                      Setup
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b]">
                      Timeline
                    </TabsTrigger>
                    <TabsTrigger value="report" className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b]">
                      Full Report
                    </TabsTrigger>
                    <TabsTrigger value="file-index" className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b]">
                      File Index
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-sm rounded-md px-6 text-[13px] font-semibold text-[#64748b] hidden md:block">
                      Settings
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white border-[#e2e8f0] text-[#64748b] font-medium">{result.events.length} Incidents</Badge>
                    <Badge variant="outline" className="bg-white border-[#e2e8f0] text-[#64748b] font-medium">{result.categories.length} Categories</Badge>
                  </div>
                </div>

                <TabsContent value="dashboard" className="flex-1 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 h-full">
                    {/* Left Panel: Thematic Grouping */}
                    <div className="space-y-5 overflow-auto pr-2">
                      {/* Key Findings Section */}
                      <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white border-l-4 border-amber-400">
                        <CardHeader className="py-4">
                          <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            <CardTitle className="text-[16px] font-bold">Key Findings & Impactful Categories</CardTitle>
                          </div>
                          <CardDescription>The most significant thematic areas identified across the documentation.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-6 pb-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {impactfulCategories.map((cat, i) => (
                              <div key={i} className={`p-4 rounded-xl border ${CATEGORY_COLORS[cat.category] || 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{cat.category}</span>
                                  <Badge variant="secondary" className="bg-white/50 text-[10px]">{cat.events.length} Events</Badge>
                                </div>
                                <p className="text-[12px] font-medium leading-tight line-clamp-3">{cat.summary}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white">
                        <CardHeader className="border-b border-[#e2e8f0] py-4 flex flex-row items-center justify-between">
                          <CardTitle className="text-[16px] font-bold" style={{ fontSize: `${headerFontSize}px`, color: activeTheme.primary }}>Master Analysis Report</CardTitle>
                          <div className="flex items-center gap-2">
                            {isEditingReport ? (
                              <>
                                <Button size="sm" variant="ghost" className="h-8 text-green-600" onClick={() => setIsEditingReport(false)}>
                                  <Check className="w-4 h-4 mr-1" /> Save
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={() => {
                                  setEditedReport(result.masterReport);
                                  setIsEditingReport(false);
                                }}>
                                  <X className="w-4 h-4 mr-1" /> Cancel
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-8 text-[#64748b]" onClick={() => setIsEditingReport(true)}>
                                <Edit3 className="w-4 h-4 mr-1" /> Edit Report
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                          {isEditingReport ? (
                            <Textarea 
                              className="min-h-[500px] font-sans text-sm leading-relaxed"
                              value={editedReport}
                              onChange={(e) => setEditedReport(e.target.value)}
                            />
                          ) : (
                            <div className="prose prose-slate max-w-none prose-sm leading-relaxed text-[#334155]">
                              <ReactMarkdown>{editedReport}</ReactMarkdown>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white">
                        <CardHeader className="border-b border-[#e2e8f0] py-4 flex flex-row items-center justify-between">
                          <CardTitle className="text-[16px] font-bold" style={{ fontSize: `${headerFontSize}px`, color: activeTheme.primary }}>Strategic Recommendations</CardTitle>
                          <div className="flex items-center gap-2">
                            {isEditingRecs ? (
                              <Button size="sm" variant="ghost" className="h-8 text-green-600" onClick={() => setIsEditingRecs(false)}>
                                <Check className="w-4 h-4 mr-1" /> Done
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-8 text-[#64748b]" onClick={() => setIsEditingRecs(true)}>
                                <Edit3 className="w-4 h-4 mr-1" /> Edit List
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="space-y-3">
                            {editedRecs.map((rec, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] group">
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[10px] font-bold text-[#2563eb]">{i + 1}</span>
                                </div>
                                {isEditingRecs ? (
                                  <div className="flex-1 flex gap-2">
                                    <Input 
                                      value={rec} 
                                      onChange={(e) => {
                                        const newRecs = [...editedRecs];
                                        newRecs[i] = e.target.value;
                                        setEditedRecs(newRecs);
                                      }}
                                      className="h-8 text-sm"
                                    />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => setEditedRecs(editedRecs.filter((_, idx) => idx !== i))}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="text-[13px] text-[#334155] leading-relaxed">{rec}</p>
                                )}
                              </div>
                            ))}
                            {isEditingRecs && (
                              <Button variant="outline" className="w-full border-dashed" onClick={() => setEditedRecs([...editedRecs, 'New recommendation...'])}>
                                <Plus className="w-4 h-4 mr-2" /> Add Recommendation
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Panel: Themes & Styling */}
                    <div className="space-y-5 overflow-auto">
                      <div className="p-6 bg-[#1e293b] rounded-2xl text-white">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                            <Palette className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold">Report Styling</h3>
                            <p className="text-[11px] text-slate-400">Customize the look & feel</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              <span>Header Size</span>
                              <span>{headerFontSize}px</span>
                            </div>
                            <Slider 
                              value={[headerFontSize]} 
                              onValueChange={(v: number[]) => setHeaderFontSize(v[0])} 
                              min={16} 
                              max={48} 
                              step={1}
                              className="py-2"
                            />
                          </div>

                          <div className="space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Theme Palette</span>
                            <div className="grid grid-cols-4 gap-2">
                              {THEMES.map(t => (
                                <button 
                                  key={t.id}
                                  onClick={() => setActiveTheme(t)}
                                  className={`h-8 rounded-lg border-2 transition-all ${activeTheme.id === t.id ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                  style={{ backgroundColor: t.primary }}
                                  title={t.name}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white">
                        <CardHeader className="border-b border-[#e2e8f0] py-4">
                          <CardTitle className="text-[14px] font-bold">Thematic Grouping</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {result.categories.map((cat, i) => (
                              <div key={i} className="p-4 rounded-lg border border-[#f1f5f9] bg-[#f8fafc] hover:border-[#e2e8f0] transition-all">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${CATEGORY_COLORS[cat.category] || 'bg-[#e2e8f0] text-[#475569]'}`}>
                                    {cat.category}
                                  </span>
                                  <span className="text-[10px] text-[#94a3b8] font-bold">{cat.events.length} Events</span>
                                </div>
                                <h4 className="text-[13px] font-bold mb-1">{cat.category} Analysis</h4>
                                <p className="text-[11px] text-[#64748b] line-clamp-2">{cat.summary}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="charts" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full overflow-auto">
                    <CardHeader className="border-b border-[#e2e8f0] py-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-[18px] font-bold">Data Visualizations</CardTitle>
                          <CardDescription>
                            AI-generated trends and distributions. You can edit data or exclude specific charts.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {result.charts.length - excludedCharts.length} Active Charts
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {result.charts.map((chart, idx) => (
                          <div 
                            key={idx} 
                            className={`p-6 rounded-2xl border transition-all ${excludedCharts.includes(idx) ? 'opacity-40 grayscale bg-slate-50' : 'bg-white border-[#e2e8f0] shadow-sm'}`}
                          >
                            <div className="flex items-center justify-between mb-6">
                              <div>
                                <h3 className="text-lg font-bold text-[#1e293b]">{chart.title}</h3>
                                <p className="text-sm text-[#64748b]">{chart.description}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-[11px] font-bold uppercase tracking-wider"
                                  onClick={() => setEditingChart({ index: idx, chart: { ...chart } })}
                                >
                                  Edit Data
                                </Button>
                                  <Button 
                                    variant={excludedCharts.includes(idx) ? "secondary" : "ghost"} 
                                    size="sm" 
                                    className={`h-8 text-[11px] font-bold uppercase tracking-wider ${excludedCharts.includes(idx) ? '' : 'text-red-500 hover:text-red-600'}`}
                                    onClick={() => {
                                      if (excludedCharts.includes(idx)) {
                                        setExcludedCharts(excludedCharts.filter(i => i !== idx));
                                      } else {
                                        setExcludedCharts([...excludedCharts, idx]);
                                      }
                                    }}
                                  >
                                    {excludedCharts.includes(idx) ? 'Include' : 'Exclude'}
                                  </Button>
                              </div>
                            </div>

                            <div className="h-[300px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                {chart.type === 'bar' ? (
                                  <BarChart data={chart.data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey={chart.xAxisKey || 'name'} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey={chart.yAxisKey || 'value'} fill="#2563eb" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                ) : chart.type === 'line' ? (
                                  <LineChart data={chart.data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey={chart.xAxisKey || 'name'} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Line type="monotone" dataKey={chart.yAxisKey || 'value'} stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
                                  </LineChart>
                                ) : chart.type === 'pie' ? (
                                  <PieChart>
                                    <Pie
                                      data={chart.data}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={5}
                                      dataKey={chart.yAxisKey || 'value'}
                                    >
                                      {chart.data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                      ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Legend verticalAlign="bottom" align="center" iconType="circle" />
                                  </PieChart>
                                ) : (
                                  <AreaChart data={chart.data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey={chart.xAxisKey || 'name'} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Area type="monotone" dataKey={chart.yAxisKey || 'value'} stroke="#2563eb" fillOpacity={1} fill="url(#colorValue)" />
                                    <defs>
                                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                  </AreaChart>
                                )}
                              </ResponsiveContainer>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {customPages.map(page => (
                  <TabsContent key={page.id} value={`page-${page.id}`} className="flex-1 mt-0">
                    <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full flex flex-col">
                      <CardHeader className="border-b border-[#e2e8f0] py-4 flex flex-row items-center justify-between shrink-0">
                        <div className="flex-1 mr-4">
                          <Input 
                            value={page.title} 
                            onChange={(e) => updatePageTitle(page.id, e.target.value)}
                            className="text-[18px] font-bold border-none bg-transparent h-auto p-0 focus-visible:ring-0"
                            style={{ color: activeTheme.primary }}
                          />
                          <CardDescription>Free-form custom page. Supports markdown formatting.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => deletePage(page.id)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Page
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 flex flex-col">
                        {page.templateId === 'comparison' ? (
                          <div className="flex-1 flex flex-col p-6 gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Item A (Select Document or Theme)</Label>
                                <Select value={comparisonItemA} onValueChange={setComparisonItemA}>
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select first item..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <div className="p-2 text-[10px] font-bold text-slate-400 uppercase">Documents</div>
                                    {documents.map((doc, i) => (
                                      <SelectItem key={`doc-a-${i}`} value={doc.content}>{doc.name}</SelectItem>
                                    ))}
                                    <div className="p-2 text-[10px] font-bold text-slate-400 uppercase">Categories</div>
                                    {result?.categories.map((t, i) => (
                                      <SelectItem key={`theme-a-${i}`} value={t.summary}>{t.category}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Item B (Select Document or Theme)</Label>
                                <Select value={comparisonItemB} onValueChange={setComparisonItemB}>
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select second item..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <div className="p-2 text-[10px] font-bold text-slate-400 uppercase">Documents</div>
                                    {documents.map((doc, i) => (
                                      <SelectItem key={`doc-b-${i}`} value={doc.content}>{doc.name}</SelectItem>
                                    ))}
                                    <div className="p-2 text-[10px] font-bold text-slate-400 uppercase">Categories</div>
                                    {result?.categories.map((t, i) => (
                                      <SelectItem key={`theme-b-${i}`} value={t.summary}>{t.category}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button 
                              onClick={handleComparison} 
                              disabled={!comparisonItemA || !comparisonItemB || isComparing}
                              className="w-full bg-blue-600 hover:bg-blue-700"
                            >
                              {isComparing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                              Generate AI Comparison
                            </Button>
                            
                            <div className="flex-1 overflow-auto bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-6">
                              {comparisonResult ? (
                                <div className="prose prose-slate max-w-none prose-sm leading-relaxed text-[#334155]">
                                  <ReactMarkdown>{comparisonResult}</ReactMarkdown>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
                                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                                  Select two items above and click generate to see an AI-powered comparison.
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-x divide-[#e2e8f0]">
                            <div className="p-6 flex flex-col">
                              <Label className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-3">Editor</Label>
                              <Textarea 
                                className="flex-1 resize-none border-none bg-[#f8fafc] p-4 rounded-xl focus-visible:ring-0 font-mono text-sm"
                                placeholder="Type your content here (Markdown supported)..."
                                value={page.content}
                                onChange={(e) => updatePageContent(page.id, e.target.value)}
                              />
                            </div>
                            <div className="p-6 overflow-auto">
                              <Label className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-3">Preview</Label>
                              <div className="prose prose-slate max-w-none prose-sm leading-relaxed text-[#334155]">
                                <ReactMarkdown>{page.content}</ReactMarkdown>
                                {page.templateId === 'ending' && (
                                  <div className="mt-12 pt-8 border-t border-slate-200">
                                    <div className="flex flex-col gap-1">
                                      <div className="w-64 h-px bg-slate-400 mb-2" />
                                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Authorized Signature</p>
                                      <p className="text-[10px] text-slate-400">Digital ID: {Math.random().toString(36).substr(2, 12).toUpperCase()}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}

                <TabsContent value="setup" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full">
                    <CardHeader className="border-b border-[#e2e8f0] py-6">
                      <div className="flex items-center gap-3 mb-1">
                        <Settings className="w-5 h-5 text-[#2563eb]" />
                        <CardTitle className="text-[18px] font-bold">Analysis Configuration</CardTitle>
                      </div>
                      <CardDescription>
                        Fine-tune the AI's focus by specifying the jurisdiction, field, and legal framework.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 max-w-4xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-[13px] font-bold text-[#1e293b]">Admin/Analyst Name</Label>
                            <Input 
                              placeholder="e.g. Admin_01" 
                              value={context.adminName}
                              onChange={(e) => setContext({...context, adminName: e.target.value})}
                              className="bg-[#f8fafc] border-[#e2e8f0]"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[13px] font-bold text-[#1e293b]">Case References</Label>
                              <Button variant="ghost" size="sm" onClick={handleAddCaseRef} className="h-6 text-[10px] text-blue-600">
                                <Plus className="w-3 h-3 mr-1" /> Add Ref
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {context.caseRefs?.map((ref, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <Input 
                                    placeholder="Label (e.g. Case Ref)" 
                                    value={ref.label}
                                    onChange={(e) => handleUpdateCaseRef(i, 'label', e.target.value)}
                                    className="bg-[#f8fafc] border-[#e2e8f0] h-8 text-xs"
                                  />
                                  <Input 
                                    placeholder="Value (e.g. 2024-XA-992)" 
                                    value={ref.value}
                                    onChange={(e) => handleUpdateCaseRef(i, 'value', e.target.value)}
                                    className="bg-[#f8fafc] border-[#e2e8f0] h-8 text-xs"
                                  />
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveCaseRef(i)} className="h-8 w-8 text-red-400">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[13px] font-bold text-[#1e293b]">Jurisdiction (State/Region)</Label>
                            <Input 
                              placeholder="e.g. Washington, California, Federal" 
                              value={context.state}
                              onChange={(e) => setContext({...context, state: e.target.value})}
                              className="bg-[#f8fafc] border-[#e2e8f0]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[13px] font-bold text-[#1e293b]">Field of Analysis</Label>
                            <Select value={context.field} onValueChange={(v) => {
                              let newContext = { ...context, field: v };
                              if (v === 'Mortgage (RESPA/TILA)') {
                                newContext.specificLaws = 'RESPA (Real Estate Settlement Procedures Act), TILA (Truth in Lending Act), Regulation X, Regulation Z, Dodd-Frank Act';
                                newContext.additionalContext = 'Focusing on disclosure requirements, kickbacks, unearned fees, and lending compliance.';
                              } else if (v === 'Insurance (Home & Auto)') {
                                newContext.specificLaws = 'IFCA (Insurance Fair Conduct Act), CPA (Consumer Protection Act), RCW 48.30, WAC 284-30';
                                newContext.additionalContext = 'Focusing on bad faith practices and claims handling guidelines in WA state.';
                              }
                              setContext(newContext);
                            }}>
                              <SelectTrigger className="bg-[#f8fafc] border-[#e2e8f0]">
                                <SelectValue placeholder="Select Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELDS.map(f => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-[13px] font-bold text-[#1e293b]">Pertinent Law Types</Label>
                            <div className="grid grid-cols-1 gap-2">
                              {LAW_TYPES.map(type => (
                                <div key={type.id} className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={type.id} 
                                    checked={context.lawTypes.includes(type.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setContext({...context, lawTypes: [...context.lawTypes, type.id]});
                                      } else {
                                        setContext({...context, lawTypes: context.lawTypes.filter(id => id !== type.id)});
                                      }
                                    }}
                                  />
                                  <label htmlFor={type.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {type.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label className="text-[13px] font-bold text-[#1e293b]">Specific Laws & Citations</Label>
                            <Textarea 
                              placeholder="e.g. IFCA, CPA, RCW 48.30, WAC 284-30..." 
                              className="min-h-[120px] bg-[#f8fafc] border-[#e2e8f0] resize-none"
                              value={context.specificLaws}
                              onChange={(e) => setContext({...context, specificLaws: e.target.value})}
                            />
                            <p className="text-[11px] text-[#64748b]">List specific acts, statutes, or codes the AI should prioritize.</p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[13px] font-bold text-[#1e293b]">Additional Context (Freeform)</Label>
                            <Textarea 
                              placeholder="Describe specific goals, concerns, or background details..." 
                              className="min-h-[120px] bg-[#f8fafc] border-[#e2e8f0] resize-none"
                              value={context.additionalContext}
                              onChange={(e) => setContext({...context, additionalContext: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-10 p-6 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 text-[#2563eb]" />
                        </div>
                        <div>
                          <h4 className="text-[14px] font-bold text-[#1e293b] mb-1">Ready for Intelligence Analysis</h4>
                          <p className="text-[12px] text-[#64748b] leading-relaxed">
                            Your configuration is saved. When you start the analysis, the AI will use these parameters to filter and focus its research, ensuring the resulting report is tailored to your specific legal and industry requirements.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="timeline" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full">
                    <CardHeader className="border-b border-[#e2e8f0] py-4 flex flex-row items-center justify-between">
                      <CardTitle className="text-[14px] font-bold">Comprehensive Case Timeline</CardTitle>
                      <Dialog open={isAddingEvent} onOpenChange={setIsAddingEvent}>
                        <DialogTrigger render={<Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
                          <Plus className="w-3 h-3 mr-2" /> Add Event
                        </Button>} />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Timeline Event</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label>Date</Label>
                              <Input type="date" id="new-event-date" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Title</Label>
                              <Input id="new-event-title" placeholder="Event title..." />
                            </div>
                            <div className="grid gap-2">
                              <Label>Category</Label>
                              <Select id="new-event-category">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIMELINE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Sub-Category</Label>
                              <Input id="new-event-subcategory" placeholder="e.g. Initial Call, Denial Letter..." />
                            </div>
                            <div className="grid gap-2">
                              <Label>Description</Label>
                              <Textarea id="new-event-desc" placeholder="Detailed description..." />
                            </div>
                            <div className="grid gap-2">
                              <Label>Strategic Impact</Label>
                              <Textarea id="new-event-impact" placeholder="Why is this important?" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Importance</Label>
                              <Select id="new-event-importance">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Importance" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button onClick={() => {
                            const date = (document.getElementById('new-event-date') as HTMLInputElement).value;
                            const title = (document.getElementById('new-event-title') as HTMLInputElement).value;
                            const category = (document.querySelector('[id="new-event-category"] [data-value]') as HTMLElement)?.dataset.value || TIMELINE_CATEGORIES[0];
                            const subCategory = (document.getElementById('new-event-subcategory') as HTMLInputElement).value;
                            const description = (document.getElementById('new-event-desc') as HTMLTextAreaElement).value;
                            const strategicImpact = (document.getElementById('new-event-impact') as HTMLTextAreaElement).value;
                            const importance = (document.querySelector('[id="new-event-importance"] [data-value]') as HTMLElement)?.dataset.value as any || 'medium';
                            
                            if (date && title) {
                              handleAddEvent({ date, title, category, subCategory, description, strategicImpact, importance });
                            }
                          }}>Add to Timeline</Button>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="relative pl-8 border-l-2 border-[#e2e8f0] space-y-10">
                        {filteredEvents.map((event, i) => (
                          <div key={i} className="relative group">
                            <div className={`absolute -left-[41px] top-1 rounded-full bg-white border-[3px] z-10 ${
                              event.importance === 'high' 
                                ? 'w-5 h-5 -left-[41.5px] border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]' 
                                : 'w-4 h-4 border-[#2563eb]'
                            }`} />
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">{formatDate(event.date)}</span>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => setEditingEvent({ index: i, event: { ...event } })}>
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteEvent(i)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <h3 className="text-[16px] font-bold text-[#0f172a] flex items-center gap-2">
                                  {event.importance === 'high' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                  {event.title}
                                </h3>
                                <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-tighter px-1.5 border ${CATEGORY_COLORS[event.category] || 'bg-slate-100 text-slate-700'}`}>
                                  {event.category}
                                </Badge>
                                <Badge variant="secondary" className="text-[9px] bg-[#f1f5f9] text-[#475569] border-none">{event.subCategory}</Badge>
                              </div>
                              <p className="text-[13px] text-[#64748b] leading-relaxed max-w-2xl">{event.description}</p>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-fit text-[#2563eb] h-auto p-0 text-[12px] font-bold hover:bg-transparent hover:underline mt-1 flex items-center gap-1"
                                onClick={() => setSelectedEvent(event)}
                              >
                                <Info className="w-3 h-3" />
                                View Strategic Impact
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="report" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full overflow-auto">
                    <CardContent className="p-16 max-w-4xl mx-auto">
                      <div className="prose prose-slate max-w-none font-serif prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-p:text-[#334155] prose-p:text-lg prose-p:leading-relaxed">
                        <ReactMarkdown 
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-4xl font-bold mb-8 border-b border-[#e2e8f0] pb-6 text-[#1e293b]" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-12 mb-6 text-[#1e293b]" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-8 mb-4 text-[#2563eb] uppercase tracking-wide" {...props} />,
                            p: ({node, ...props}) => <p className="mb-6" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-8 space-y-3" {...props} />,
                            li: ({node, ...props}) => <li className="text-lg" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#2563eb] pl-8 italic my-10 text-2xl text-[#64748b] bg-[#f8fafc] py-6 pr-6 rounded-r-lg" {...props} />,
                          }}
                        >
                          {result.masterReport}
                        </ReactMarkdown>
                      </div>
                      
                      <Separator className="my-12" />
                      
                      <div className="grid grid-cols-2 gap-12 font-sans">
                        <div className="space-y-4">
                          <h4 className="text-[13px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" />
                            Legal Implications
                          </h4>
                          <ul className="space-y-3">
                            {result.legalImplications.map((item, i) => (
                              <li key={i} className="text-sm text-[#64748b] flex gap-3">
                                <span className="text-[#2563eb] font-bold">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-[13px] font-bold text-[#2563eb] uppercase tracking-widest flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Strategic Recommendations
                          </h4>
                          <ul className="space-y-3">
                            {result.recommendations.map((item, i) => (
                              <li key={i} className="text-sm text-[#64748b] flex gap-3">
                                <span className="text-[#2563eb] font-bold">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {result.metadataInsights && result.metadataInsights.length > 0 && (
                        <>
                          <Separator className="my-12" />
                          <div className="space-y-6 font-sans">
                            <h4 className="text-[13px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                              <SearchCode className="w-4 h-4" />
                              Deep Metadata Analysis Insights
                            </h4>
                            <div className="grid gap-4">
                              {result.metadataInsights.map((insight, i) => (
                                <div key={i} className="bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                                  <h5 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5" />
                                    {insight.fileName}
                                  </h5>
                                  <p className="text-sm text-amber-800 leading-relaxed">
                                    {insight.insights}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {includeIndexInReport && (
                        <>
                          <Separator className="my-12" />
                          <div className="space-y-6 font-sans">
                            <h4 className="text-[13px] font-bold text-[#2563eb] uppercase tracking-widest flex items-center gap-2">
                              <SearchCode className="w-4 h-4" />
                              Source Document Index
                            </h4>
                            <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                              <table className="w-full text-left text-[12px]">
                                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                  <tr>
                                    <th className="px-3 py-2 font-bold text-[#0f172a]">File Name</th>
                                    <th className="px-3 py-2 font-bold text-[#0f172a]">Pages</th>
                                    <th className="px-3 py-2 font-bold text-[#0f172a]">SHA-256 Hash</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f1f5f9]">
                                  {documents.map((doc, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-2 font-medium text-[#1e293b]">{doc.name}</td>
                                      <td className="px-3 py-2 text-[#64748b]">{doc.pageCount || 'N/A'}</td>
                                      <td className="px-3 py-2 font-mono text-[#94a3b8] break-all">{doc.hash}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="text-[11px] text-[#94a3b8] italic">
                              Note: Hashes are provided for cryptographic verification of document integrity. Any modification to the source file will result in a different hash.
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="file-index" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full flex flex-col">
                    <CardHeader className="py-4 border-b border-[#f1f5f9]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SearchCode className="w-5 h-5 text-[#2563eb]" />
                          <CardTitle className="text-[16px] font-bold">Master File Index & Integrity Log</CardTitle>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                             <Checkbox 
                               id="include-index" 
                               checked={includeIndexInReport} 
                               onCheckedChange={(checked) => setIncludeIndexInReport(!!checked)}
                             />
                             <Label htmlFor="include-index" className="text-xs font-medium text-[#64748b]">Include in Full Report</Label>
                          </div>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {documents.length} Files Indexed
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>Comprehensive list of all source documents with cryptographic hashes for verification.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="p-6 space-y-8">
                          {/* Integrity Instructions */}
                          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-5">
                            <h3 className="text-sm font-bold text-[#0f172a] mb-3 flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-amber-500" />
                              Hash Integrity Instructions
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px]">
                              <div className="space-y-2">
                                <p className="font-semibold text-green-700">What you CAN do:</p>
                                <ul className="list-disc list-inside space-y-1 text-[#475569]">
                                  <li>Reference these hashes in legal filings to prove document authenticity.</li>
                                  <li>Use the hash to verify that a document has not been altered since upload.</li>
                                  <li>Share this index with auditors to provide a clear chain of custody.</li>
                                </ul>
                              </div>
                              <div className="space-y-2">
                                <p className="font-semibold text-red-700">What you MUST NOT do:</p>
                                <ul className="list-disc list-inside space-y-1 text-[#475569]">
                                  <li>Modify the file content (even a single character) as it will change the hash.</li>
                                  <li>Rename the file if you want to maintain strict correlation with external logs.</li>
                                  <li>Assume a matching filename means matching content; always verify the hash.</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          {/* File Table */}
                          <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                                <tr>
                                  <th className="px-4 py-3 font-bold text-[#0f172a]">File Name</th>
                                  <th className="px-4 py-3 font-bold text-[#0f172a]">Category</th>
                                  <th className="px-4 py-3 font-bold text-[#0f172a]">Pages</th>
                                  <th className="px-4 py-3 font-bold text-[#0f172a]">SHA-256 Hash</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#f1f5f9]">
                                {documents.map((doc, idx) => (
                                  <tr key={idx} className="hover:bg-[#f8fafc] transition-colors">
                                    <td className="px-4 py-3 font-medium text-[#2563eb]">{doc.name}</td>
                                    <td className="px-4 py-3">
                                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                                        {doc.category}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-[#64748b]">
                                      {doc.pageCount || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-[11px] text-[#94a3b8] break-all">
                                      {doc.hash}
                                    </td>
                                  </tr>
                                ))}
                                {documents.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-4 py-12 text-center text-[#94a3b8] italic">
                                      No documents uploaded yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="intelligence-research" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full overflow-auto">
                    <CardHeader className="border-b border-[#e2e8f0] py-6 sticky top-0 bg-white z-10">
                      <div className="flex items-center gap-3 mb-1">
                        <Layers className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-[18px] font-bold">Research Reports</CardTitle>
                      </div>
                      <CardDescription>Detailed AI-generated research reports based on the provided documentation and context.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                      {result.intelligence.researchReports.map((report, i) => (
                        <div key={i} className="prose prose-slate max-w-none prose-sm leading-relaxed text-[#334155] p-6 bg-slate-50 rounded-xl border border-slate-100">
                          <ReactMarkdown>{report}</ReactMarkdown>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="intelligence-legal" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full overflow-auto">
                    <CardHeader className="border-b border-[#e2e8f0] py-6 sticky top-0 bg-white z-10">
                      <div className="flex items-center gap-3 mb-1">
                        <ShieldAlert className="w-5 h-5 text-purple-600" />
                        <CardTitle className="text-[18px] font-bold">Legal Analysis</CardTitle>
                      </div>
                      <CardDescription>In-depth legal analysis focusing on the specified jurisdiction and law types.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                      {result.intelligence.legalAnalysis.map((analysis, i) => (
                        <div key={i} className="prose prose-slate max-w-none prose-sm leading-relaxed text-[#334155] p-6 bg-purple-50/30 rounded-xl border border-purple-100">
                          <ReactMarkdown>{analysis}</ReactMarkdown>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="intelligence-action" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full overflow-auto">
                    <CardHeader className="border-b border-[#e2e8f0] py-6 sticky top-0 bg-white z-10">
                      <div className="flex items-center gap-3 mb-1">
                        <Zap className="w-5 h-5 text-amber-500" />
                        <CardTitle className="text-[18px] font-bold">Prioritized Action Steps</CardTitle>
                      </div>
                      <CardDescription>Recommended next steps prioritized by strategic impact and urgency.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="space-y-4">
                        {result.intelligence.actionSteps.map((step, i) => (
                          <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              step.priority === 'high' ? 'bg-red-100 text-red-600' :
                              step.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              <Zap className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                  step.priority === 'high' ? 'text-red-600' :
                                  step.priority === 'medium' ? 'text-amber-600' :
                                  'text-blue-600'
                                }`}>
                                  {step.priority} Priority
                                </span>
                              </div>
                              <p className="text-[14px] font-medium text-slate-800">{step.step}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="settings" className="flex-1 mt-0">
                  <Card className="border-[#e2e8f0] shadow-none rounded-xl bg-white h-full overflow-auto">
                    <CardHeader className="border-b border-[#e2e8f0] py-6">
                      <div className="flex items-center gap-3 mb-1">
                        <Settings className="w-5 h-5 text-slate-600" />
                        <CardTitle className="text-[18px] font-bold">Application Settings</CardTitle>
                      </div>
                      <CardDescription>Customize the application's appearance and default analysis parameters.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 max-w-2xl space-y-8">
                      <div className="space-y-4">
                        <Label className="text-[14px] font-bold">Visual Theme</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {THEMES.map(theme => (
                            <div 
                              key={theme.id}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${activeTheme.id === theme.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                              onClick={() => setActiveTheme(theme)}
                            >
                              <div className="w-full h-8 rounded-md mb-2" style={{ backgroundColor: theme.primary }} />
                              <span className="text-[12px] font-bold text-slate-700">{theme.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[14px] font-bold">Report Header Font Size</Label>
                        <div className="flex items-center gap-4">
                          <Input 
                            type="range" 
                            min="16" 
                            max="32" 
                            value={headerFontSize} 
                            onChange={(e) => setHeaderFontSize(parseInt(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-sm font-bold w-12">{headerFontSize}px</span>
                        </div>
                      </div>

                      <div className="pt-8 border-t border-slate-100">
                        <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={() => {
                          if (confirm("Are you sure you want to clear all analysis data? This cannot be undone.")) {
                            setResult(null);
                            setDocuments([]);
                            setCustomPages([]);
                            setActiveTab('dashboard');
                          }
                        }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Reset All Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{selectedEvent?.title}</DialogTitle>
            <DialogDescription className="text-[#64748b]">
              Strategic Impact & Analysis Connection
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-1.5 border ${CATEGORY_COLORS[selectedEvent?.category || ''] || 'bg-[#f1f5f9] border-[#e2e8f0] text-[#475569]'}`}>
                {selectedEvent?.category}
              </Badge>
              <Badge variant="secondary" className="text-[10px] bg-[#f1f5f9] text-[#475569] border-none">
                {selectedEvent?.subCategory}
              </Badge>
              <span className="text-[12px] text-[#64748b] font-medium">
                {selectedEvent && formatDate(selectedEvent.date)}
              </span>
            </div>
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-5">
              <h4 className="text-[11px] font-bold text-[#2563eb] uppercase tracking-widest mb-3">Analysis Connection</h4>
              <p className="text-[14px] text-[#334155] leading-relaxed whitespace-pre-wrap italic">
                "{selectedEvent?.strategicImpact}"
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setSelectedEvent(null)} className="bg-[#2563eb] text-white hover:bg-[#1d4ed8]">
              Close Analysis
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Timeline Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={editingEvent?.event.date} 
                onChange={(e) => setEditingEvent(prev => prev ? { ...prev, event: { ...prev.event, date: e.target.value } } : null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input 
                value={editingEvent?.event.title} 
                onChange={(e) => setEditingEvent(prev => prev ? { ...prev, event: { ...prev.event, title: e.target.value } } : null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select 
                value={editingEvent?.event.category} 
                onValueChange={(v) => setEditingEvent(prev => prev ? { ...prev, event: { ...prev.event, category: v } } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sub-Category</Label>
              <Input 
                value={editingEvent?.event.subCategory} 
                onChange={(e) => setEditingEvent(prev => prev ? { ...prev, event: { ...prev.event, subCategory: e.target.value } } : null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea 
                value={editingEvent?.event.description} 
                onChange={(e) => setEditingEvent(prev => prev ? { ...prev, event: { ...prev.event, description: e.target.value } } : null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Strategic Impact</Label>
              <Textarea 
                value={editingEvent?.event.strategicImpact} 
                onChange={(e) => setEditingEvent(prev => prev ? { ...prev, event: { ...prev.event, strategicImpact: e.target.value } } : null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Importance</Label>
              <Select 
                value={editingEvent?.event.importance} 
                onValueChange={(v) => setEditingEvent(prev => prev ? { ...prev, event: { ...prev.event, importance: v as any } } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleUpdateEvent}>Save Changes</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingChart} onOpenChange={(open) => !open && setEditingChart(null)}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Customize Visualization</DialogTitle>
            <DialogDescription>
              Adjust the chart type, metadata, and data points for this visualization.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Chart Title</Label>
                  <Input 
                    value={editingChart?.chart.title} 
                    onChange={(e) => setEditingChart(prev => prev ? { ...prev, chart: { ...prev.chart, title: e.target.value } } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chart Type</Label>
                  <Select 
                    value={editingChart?.chart.type} 
                    onValueChange={(v) => setEditingChart(prev => prev ? { ...prev, chart: { ...prev.chart, type: v as any } } : null)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                      <SelectItem value="area">Area Chart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={editingChart?.chart.description} 
                  onChange={(e) => setEditingChart(prev => prev ? { ...prev, chart: { ...prev.chart, description: e.target.value } } : null)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] uppercase tracking-widest font-bold text-[#64748b]">Data Points</Label>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-[10px]"
                    onClick={() => {
                      if (!editingChart) return;
                      const xAxisKey = editingChart.chart.xAxisKey || 'name';
                      const yAxisKey = editingChart.chart.yAxisKey || 'value';
                      const newData = [...editingChart.chart.data, { [xAxisKey]: 'New Point', [yAxisKey]: 0 }];
                      setEditingChart({ ...editingChart, chart: { ...editingChart.chart, data: newData } });
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Point
                  </Button>
                </div>
                <div className="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f8fafc] border-b sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-3 font-bold text-[#64748b]">Label</th>
                        <th className="text-left p-3 font-bold text-[#64748b]">Value</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {editingChart?.chart.data.map((row: any, i: number) => (
                        <tr key={i} className="bg-white">
                          <td className="p-2">
                            <Input 
                              className="h-8 border-none focus-visible:ring-0" 
                              value={row[editingChart.chart.xAxisKey || 'name']} 
                              onChange={(e) => {
                                const newData = [...editingChart.chart.data];
                                newData[i] = { ...newData[i], [editingChart.chart.xAxisKey || 'name']: e.target.value };
                                setEditingChart({ ...editingChart, chart: { ...editingChart.chart, data: newData } });
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Input 
                              type="number"
                              className="h-8 border-none focus-visible:ring-0" 
                              value={row[editingChart.chart.yAxisKey || 'value']} 
                              onChange={(e) => {
                                const newData = [...editingChart.chart.data];
                                newData[i] = { ...newData[i], [editingChart.chart.yAxisKey || 'value']: parseFloat(e.target.value) || 0 };
                                setEditingChart({ ...editingChart, chart: { ...editingChart.chart, data: newData } });
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-500"
                              onClick={() => {
                                const newData = editingChart.chart.data.filter((_: any, idx: number) => idx !== i);
                                setEditingChart({ ...editingChart, chart: { ...editingChart.chart, data: newData } });
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] uppercase tracking-widest font-bold text-[#64748b]">Live Preview</Label>
              <div className="border rounded-2xl p-6 bg-white h-[400px] flex flex-col">
                <h3 className="text-md font-bold text-[#1e293b] mb-1">{editingChart?.chart.title}</h3>
                <p className="text-xs text-[#64748b] mb-6">{editingChart?.chart.description}</p>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    {editingChart?.chart.type === 'bar' ? (
                      <BarChart data={editingChart.chart.data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={editingChart.chart.xAxisKey || 'name'} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey={editingChart.chart.yAxisKey || 'value'} fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : editingChart?.chart.type === 'line' ? (
                      <LineChart data={editingChart.chart.data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={editingChart.chart.xAxisKey || 'name'} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey={editingChart.chart.yAxisKey || 'value'} stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : editingChart?.chart.type === 'area' ? (
                      <AreaChart data={editingChart.chart.data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={editingChart.chart.xAxisKey || 'name'} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey={editingChart.chart.yAxisKey || 'value'} stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} />
                      </AreaChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={editingChart?.chart.data}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey={editingChart?.chart.yAxisKey || 'value'}
                          nameKey={editingChart?.chart.xAxisKey || 'name'}
                        >
                          {editingChart?.chart.data.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingChart(null)}>Cancel</Button>
            <Button 
              className="bg-[#2563eb] text-white"
              onClick={() => {
                if (!editingChart || !result) return;
                const newCharts = [...result.charts];
                newCharts[editingChart.index] = editingChart.chart;
                setResult({ ...result, charts: newCharts });
                setEditingChart(null);
              }}
            >
              Update Visualization
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
