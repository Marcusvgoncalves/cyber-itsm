'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { BookOpen, Search, Filter, Plus, ArrowLeft, ShieldCheck, Calendar, User, FileText, RefreshCw } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  content: string;
  framework: 'nist' | 'cis' | 'iso' | 'sabsa';
  framework_category: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  author?: { full_name: string | null; email: string };
}

const FRAMEWORKS = [
  { id: 'nist', name: 'NIST CSF' },
  { id: 'cis', name: 'CIS Controls' },
  { id: 'iso', name: 'ISO/IEC 27001' },
  { id: 'sabsa', name: 'SABSA' },
];

const CATEGORIES: Record<string, string[]> = {
  nist: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
  cis: ['Basic Controls (1-6)', 'Foundational Controls (7-16)', 'Organizational Controls (17-20)'],
  iso: ['Organizational Controls', 'People Controls', 'Physical Controls', 'Technological Controls'],
  sabsa: ['Contextual Layer', 'Conceptual Layer', 'Logical Layer', 'Physical Layer', 'Component Layer', 'Operational Layer'],
};

export default function KnowledgeBase() {
  const { user, profile } = useAuth();
  const supabase = createBrowserClientInstance();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // View States
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');

  // Form States
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFramework, setNewFramework] = useState<'nist' | 'cis' | 'iso' | 'sabsa'>('nist');
  const [newCategory, setNewCategory] = useState('Identify');
  const [publishing, setPublishing] = useState(false);

  // Fetch articles
  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kb_articles')
        .select('*, author:author_id (full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (err) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  // Filter logic
  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFramework = frameworkFilter === 'all' || a.framework === frameworkFilter;
    return matchesSearch && matchesFramework;
  });

  // Handle publishing
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !user) return;
    setPublishing(true);

    try {
      const { error } = await supabase.from('kb_articles').insert({
        title: newTitle.trim(),
        content: newContent.trim(),
        framework: newFramework,
        framework_category: newCategory,
        author_id: user.id,
      });

      if (error) throw error;

      // Reset
      setNewTitle('');
      setNewContent('');
      setNewFramework('nist');
      setNewCategory('Identify');
      setIsCreating(false);
      await fetchArticles();
    } catch (err) {
      console.error('Error publishing article:', err);
      alert('Erro ao publicar artigo.');
    } finally {
      setPublishing(false);
    }
  };

  // Sync default category when framework changes in form
  const handleFrameworkChange = (val: 'nist' | 'cis' | 'iso' | 'sabsa') => {
    setNewFramework(val);
    setNewCategory(CATEGORIES[val]?.[0] || '');
  };

  // Check RBAC permission to write
  const canPublish = profile?.role === 'admin' || profile?.role === 'analyst';

  const priorityColors: Record<string, string> = {
    nist: 'bg-blue-600/10 text-blue-400 border-blue-500/20',
    cis: 'bg-orange-600/10 text-orange-400 border-orange-500/20',
    iso: 'bg-purple-600/10 text-purple-400 border-purple-500/20',
    sabsa: 'bg-emerald-600/10 text-emerald-450 border-emerald-500/20',
  };

  const frameworkLabels: Record<string, string> = {
    nist: 'NIST CSF',
    cis: 'CIS Controls',
    iso: 'ISO 27001',
    sabsa: 'SABSA',
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950/20 relative select-none">
      
      {/* Dynamic Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/30">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Base de Conhecimento SecOps</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Guias de arquitetura, políticas de proteção e resoluções padrão de incidentes
          </p>
        </div>

        {canPublish && !isCreating && !activeArticle && (
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-3 rounded-lg flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publicar Artigo</span>
          </Button>
        )}
      </div>

      {/* Workspace Area */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">

        {/* 1. READ ARTICLE VIEW */}
        {activeArticle ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <button
              onClick={() => setActiveArticle(null)}
              className="inline-flex items-center space-x-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar aos Artigos</span>
            </button>

            <article className="bg-slate-900 border border-slate-850 rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-xl shadow-xl">
              <div className="space-y-4 border-b border-slate-800 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${priorityColors[activeArticle.framework]}`}>
                    {frameworkLabels[activeArticle.framework]}
                  </span>
                  {activeArticle.framework_category && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-950 text-slate-400 border border-slate-850">
                      {activeArticle.framework_category}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">{activeArticle.title}</h2>
                
                <div className="flex flex-wrap items-center gap-4 text-slate-500 text-xs pt-1.5">
                  <div className="flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Por: {activeArticle.author?.full_name || 'Autor'}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Publicado em: {new Date(activeArticle.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                {activeArticle.content}
              </div>
            </article>
          </div>
        ) : isCreating ? (
          /* 2. CREATE ARTICLE FORM */
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setIsCreating(false)}
              className="inline-flex items-center space-x-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>

            <form onSubmit={handlePublish} className="bg-slate-900 border border-slate-850 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-5">
              <h2 className="text-base font-bold text-white flex items-center space-x-2 pb-3 border-b border-slate-800">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span>Publicar Novo Artigo SecOps</span>
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Título do Artigo
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Padrão de Configuração de Segurança para Buckets AWS S3"
                  className="w-full px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-white text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Framework Vinculado
                  </label>
                  <select
                    value={newFramework}
                    onChange={(e) => handleFrameworkChange(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none text-white text-xs cursor-pointer"
                  >
                    {FRAMEWORKS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Categoria do Framework
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none text-white text-xs cursor-pointer"
                  >
                    {(CATEGORIES[newFramework] || []).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Conteúdo do Artigo / SOP
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Escreva as diretrizes técnicas de arquitetura, links de referência, códigos de configuração..."
                  rows={8}
                  className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-white text-xs resize-y"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  variant="outline"
                  className="border-slate-800 text-xs px-3 h-8"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={publishing}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 h-8"
                >
                  {publishing ? 'Publicando...' : 'Publicar'}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* 3. ARTICLES LIST VIEW */
          <div className="space-y-6">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/30 border border-slate-900 p-4 rounded-2xl backdrop-blur-xl">
              <div className="relative w-full sm:w-72">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar artigos..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-slate-200 placeholder-slate-655 text-xs transition-all"
                />
              </div>

              <div className="flex items-center space-x-1.5 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={frameworkFilter}
                  onChange={(e) => setFrameworkFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-350 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todos Frameworks</option>
                  {FRAMEWORKS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Articles Grid */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-xs">Carregando artigos...</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-850 rounded-2xl text-slate-650 text-xs">
                Nenhum artigo encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredArticles.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setActiveArticle(a)}
                    className="bg-slate-900 border border-slate-850 hover:border-slate-750/70 p-5 rounded-2xl cursor-pointer shadow-lg hover:shadow-blue-500/5 transition-all duration-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${priorityColors[a.framework]}`}>
                          {frameworkLabels[a.framework]}
                        </span>
                        {a.framework_category && (
                          <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-slate-950 text-slate-400 border border-slate-850">
                            {a.framework_category}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-200 leading-snug line-clamp-2">
                        {a.title}
                      </h3>
                      
                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                        {a.content}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-550">
                      <span>Por: {a.author?.full_name || 'Autor'}</span>
                      <span>{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
