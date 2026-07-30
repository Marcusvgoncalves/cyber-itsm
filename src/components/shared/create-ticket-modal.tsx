'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import { useAuth, Profile } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { X, ShieldAlert, FileText, User } from 'lucide-react';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Cybersecurity framework mapping details
type CategoryMap = Record<string, string[]>;
type SubcategoryMap = Record<string, Record<string, string[]>>;

const FRAMEWORKS = [
  { id: 'nist', name: 'NIST CSF (Cybersecurity Framework)' },
  { id: 'cis', name: 'CIS Controls' },
  { id: 'iso', name: 'ISO/IEC 27001' },
  { id: 'sabsa', name: 'SABSA Architecture' },
];

const CATEGORIES: CategoryMap = {
  nist: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
  cis: ['Basic Controls (1-6)', 'Foundational Controls (7-16)', 'Organizational Controls (17-20)'],
  iso: ['Organizational Controls', 'People Controls', 'Physical Controls', 'Technological Controls'],
  sabsa: ['Contextual Layer', 'Conceptual Layer', 'Logical Layer', 'Physical Layer', 'Component Layer', 'Operational Layer'],
};

const SUBCATEGORIES: SubcategoryMap = {
  nist: {
    Identify: ['Asset Management', 'Risk Assessment', 'Governance', 'Business Environment'],
    Protect: ['Access Control', 'Awareness & Training', 'Data Security', 'Information Protection'],
    Detect: ['Anomalies and Events', 'Security Continuous Monitoring', 'Detection Processes'],
    Respond: ['Response Planning', 'Incident Analysis', 'Mitigation Actions', 'Improvements'],
    Recover: ['Recovery Planning', 'Security Improvements', 'Communications'],
  },
  cis: {
    'Basic Controls (1-6)': [
      'CIS 1: Inventory of Enterprise Assets',
      'CIS 2: Inventory of Software Assets',
      'CIS 3: Data Protection',
      'CIS 4: Secure Configuration',
      'CIS 5: Account Management',
      'CIS 6: Access Control Management',
    ],
    'Foundational Controls (7-16)': [
      'CIS 7: Vulnerability Management',
      'CIS 8: Audit Log Management',
      'CIS 9: Email & Web Browser Defense',
      'CIS 10: Malware Defense',
      'CIS 11: Recovery Capabilities',
      'CIS 12: Network Infrastructure Management',
    ],
    'Organizational Controls (17-20)': [
      'CIS 17: Incident Response Management',
      'CIS 18: Penetration Testing',
      'CIS 19: Security Awareness Training',
      'CIS 20: Application Software Security',
    ],
  },
  iso: {
    'Organizational Controls': ['5.1: Information Security Policies', '5.9: Inventory of Information Assets'],
    'People Controls': ['6.1: Screening candidates', '6.2: Terms & Conditions of employment'],
    'Physical Controls': ['7.1: Physical security perimeter', '7.2: Physical entry controls'],
    'Technological Controls': ['8.15: Access Control', '8.28: Secure Coding', '8.8: Technical Vulnerabilities'],
  },
  sabsa: {
    'Contextual Layer': ['Business Security Objectives', 'Risk Tolerance Profile'],
    'Conceptual Layer': ['Governance Structure', 'Trust Framework Architecture'],
    'Logical Layer': ['Logical Segregation Policy', 'Cryptographic Key Policy'],
    'Physical Layer': ['Hardware Encryption Hardware', 'Segmented Firewall Policies'],
    'Component Layer': ['Specific Security Tools (WAF, IPS)', 'IAM Directories Configuration'],
    'Operational Layer': ['Security Administration Guides', 'Incident Reporting Templates'],
  },
};

export default function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
  const { user } = useAuth();
  const supabase = createBrowserClientInstance();

  // Profiles lists
  const [analysts, setAnalysts] = useState<Profile[]>([]);
  const [loadingAnalysts, setLoadingAnalysts] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'todo' | 'backlog' | 'in_progress' | 'under_review'>('todo');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  
  const [framework, setFramework] = useState<string>('nist');
  const [category, setCategory] = useState<string>('Identify');
  const [subcategory, setSubcategory] = useState<string>('Asset Management');

  const [assigneeId, setAssigneeId] = useState<string>('');
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch security profiles (Admin & Analyst) to fill Assignees
  useEffect(() => {
    const fetchAnalysts = async () => {
      setLoadingAnalysts(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'analyst']);

        if (error) throw error;
        setAnalysts(data || []);
        if (data && data.length > 0) {
          setAssigneeId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching analysts:', err);
      } finally {
        setLoadingAnalysts(false);
      }
    };

    if (isOpen) {
      fetchAnalysts();
    }
  }, [isOpen]);

  // Sync Category and Subcategory selections when Framework updates
  const handleFrameworkChange = (val: string) => {
    setFramework(val);
    const defaultCat = CATEGORIES[val]?.[0] || '';
    setCategory(defaultCat);
    const defaultSub = SUBCATEGORIES[val]?.[defaultCat]?.[0] || '';
    setSubcategory(defaultSub);
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    const defaultSub = SUBCATEGORIES[framework]?.[val]?.[0] || '';
    setSubcategory(defaultSub);
  };

  // Submit action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setErrorMsg('O resumo do chamado é obrigatório.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title,
          description,
          status,
          priority,
          framework,
          framework_category: category,
          framework_subcategory: subcategory,
          requester_id: user?.id,
          assignee_id: assigneeId || null,
        })
        .select();

      if (error) throw error;

      // Reset form
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao criar chamado.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Container card */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-blue-500" />
            <span>Criar Novo Chamado de Segurança</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-slate-350">
          {errorMsg && (
            <div className="p-3.5 rounded-lg border border-red-500/25 bg-red-500/10 text-red-400">
              {errorMsg}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Resumo / Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Revisar segmentação de redes internas na nuvem"
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 focus:border-blue-500 text-white placeholder-slate-600 transition-all"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Descrição do Chamado
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhadamente o escopo do chamado, ameaças mapeadas ou controles a serem implementados..."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 focus:border-blue-500 text-white placeholder-slate-600 transition-all font-sans resize-y"
            />
          </div>

          {/* Double Column: Priority & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 focus:border-blue-500 text-white transition-all cursor-pointer"
              >
                <option value="low" className="bg-slate-900">Baixa (Low)</option>
                <option value="medium" className="bg-slate-900">Média (Medium)</option>
                <option value="high" className="bg-slate-900">Alta (High)</option>
                <option value="critical" className="bg-slate-900">Crítica (Critical)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 focus:border-blue-500 text-white transition-all cursor-pointer"
              >
                <option value="todo" className="bg-slate-900">A fazer (To Do)</option>
                <option value="backlog" className="bg-slate-900">Backlog</option>
                <option value="in_progress" className="bg-slate-900">Em Progresso</option>
                <option value="under_review" className="bg-slate-900">Sob Revisão</option>
              </select>
            </div>
          </div>

          {/* Taxonomy Section */}
          <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-slate-350 tracking-wide uppercase flex items-center space-x-1.5 border-b border-slate-850 pb-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Mapeamento de Framework de Cibersegurança</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Framework Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Framework
                </label>
                <select
                  value={framework}
                  onChange={(e) => handleFrameworkChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-white transition-all text-xs cursor-pointer"
                >
                  {FRAMEWORKS.map((f) => (
                    <option key={f.id} value={f.id} className="bg-slate-900">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-white transition-all text-xs cursor-pointer"
                >
                  {(CATEGORIES[framework] || []).map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Subcategoria
                </label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-white transition-all text-xs cursor-pointer"
                >
                  {(SUBCATEGORIES[framework]?.[category] || []).map((sub) => (
                    <option key={sub} value={sub} className="bg-slate-900">
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Responsável (Assignee)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={loadingAnalysts}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 focus:border-blue-500 text-white transition-all text-sm cursor-pointer"
              >
                {loadingAnalysts ? (
                  <option>Carregando analistas...</option>
                ) : analysts.length === 0 ? (
                  <option value="">Nenhum analista configurado</option>
                ) : (
                  analysts.map((analyst) => (
                    <option key={analyst.id} value={analyst.id} className="bg-slate-900">
                      {analyst.full_name || analyst.email} ({analyst.role === 'admin' ? 'Admin' : 'Analista'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end space-x-3 bg-slate-950/20">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold py-2 px-4 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-5 rounded-xl shadow-lg shadow-blue-650/10 active:scale-[0.98] transition-all"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                'Criar Chamado'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
