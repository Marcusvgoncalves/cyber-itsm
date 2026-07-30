'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Shield, Plus, LogOut, User, Key, Settings } from 'lucide-react';
import Link from 'next/link';

interface TopbarProps {
  onCreateClick: () => void;
}

export default function Topbar({ onCreateClick }: TopbarProps) {
  const { user, profile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    analyst: 'Analista',
    requester: 'Solicitante',
  };

  return (
    <header className="h-14 border-b border-slate-850 bg-slate-900 px-6 flex items-center justify-between relative z-40 select-none">
      {/* Brand & Navigation */}
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-gradient-to-tr from-blue-600 to-indigo-650 rounded-lg">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm text-white tracking-wider uppercase">CyberITSM</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          <Link
            href="/"
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-white hover:bg-slate-800 transition-colors"
          >
            Projetos
          </Link>
          <span className="text-slate-700 text-xs">/</span>
          <span className="px-3 py-1.5 text-xs text-slate-400 font-medium">Cybersecurity Desk</span>
        </nav>
      </div>

      {/* Action Area */}
      <div className="flex items-center space-x-4">
        {/* Create Button */}
        <Button
          onClick={onCreateClick}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3 h-8 rounded-md flex items-center space-x-1.5 active:scale-95 transition-all shadow-md shadow-blue-650/15"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Criar</span>
        </Button>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2.5 p-1 rounded-full hover:bg-slate-800 focus:outline-none transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center text-slate-350 text-xs font-bold font-mono">
              {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'US'}
            </div>
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay to close on click outside */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setDropdownOpen(false)}
              />

              <div className="absolute right-0 mt-2.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 py-2 text-sm animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User Info Header */}
                <div className="px-4 py-2.5 border-b border-slate-800">
                  <p className="font-bold text-white leading-none">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1 truncate">{user?.email}</p>
                  <div className="mt-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 border border-slate-700 text-slate-300">
                      {roleLabels[profile?.role || 'requester']}
                    </span>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/mfa"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Configurações de MFA</span>
                  </Link>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut();
                    }}
                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs text-red-400 hover:bg-slate-800 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
