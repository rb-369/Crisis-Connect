import React from 'react';
import webLogo from '../web-logo-2.jpeg';
import { 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Radio, 
  Activity, 
  RotateCcw, 
  Users, 
  Building2, 
  ShieldCheck, 
  Lock, 
  LogOut, 
  ChevronRight,
  UserCheck
} from 'lucide-react';

export default function Header({ 
  currentTab, 
  onTabChange, 
  wsStatus, 
  onReseed, 
  currentUser, 
  onOpenAuthModal, 
  onLogout 
}) {
  const tabs = [
    { id: 'requester', label: '1-Tap SOS (Citizen)', icon: AlertTriangle, mode: 'citizen' },
    { id: 'admin', label: 'Triage Queue', icon: ShieldAlert, mode: 'ngo' },
    { id: 'admin-map', label: 'Live GIS Map', icon: MapPin, mode: 'ngo' },
    { id: 'zone-report', label: 'Report Hazard', icon: Radio, mode: 'citizen' },
    { id: 'simulator', label: 'Volunteer Mock', icon: Users, mode: 'dev' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0F172A] border-b border-slate-800 shadow-md">
      
      {/* =========================================================================
          PERSISTENT TOP CALLOUT HEADING: "LOGIN AS A VOLUNTEER OR A NGO"
         ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800/80 px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          
          {!currentUser ? (
            /* Unauthenticated state: Persistent prominent invitation */
            <div className="flex items-center space-x-2 text-slate-300">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="font-medium">
                Are you a <strong className="text-white">Volunteer Responder</strong> or an <strong className="text-white">NGO Agency</strong>?
              </span>
            </div>
          ) : (
            /* Authenticated state: Verified badge & ID */
            <div className="flex items-center space-x-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-200">
                Verified {currentUser.role === 'volunteer' ? 'Volunteer' : 'NGO Agency'}:
              </span>
              <span className="text-white px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-mono">
                {currentUser.name} ({currentUser.id})
              </span>
            </div>
          )}

          <div className="flex items-center space-x-3">
            {!currentUser ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onOpenAuthModal('volunteer')}
                  className="px-3 py-1 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-[11px] transition shadow-sm flex items-center space-x-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Login as Volunteer</span>
                </button>

                <button
                  onClick={() => onOpenAuthModal('ngo')}
                  className="px-3 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white font-bold text-[11px] transition shadow-sm flex items-center space-x-1"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Login as NGO</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onTabChange(currentUser.role === 'volunteer' ? 'simulator' : 'admin')}
                  className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-[11px] transition flex items-center space-x-1"
                >
                  <span>Open {currentUser.role === 'volunteer' ? 'Responder Radar' : 'Mission Control'}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>

                <button
                  onClick={onLogout}
                  title="Log out and switch role"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* =========================================================================
          MAIN NAVIGATION BAR
         ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 py-2">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => onTabChange('requester')}
          >
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-red-600/20 group-hover:scale-105 transition border border-slate-700/80 flex-shrink-0 overflow-hidden">
              <img 
                src={webLogo} 
                alt="CrisisConnect" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  Crisis<span className="text-red-500">Connect</span>
                </span>
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  SOS Platform
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none hidden md:block">
                Emergency Triage & Humanitarian Coordination
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status & Quick Reseed */}
          <div className="flex items-center space-x-2.5">
            {/* Live WebSocket Indicator */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected'
                  ? 'bg-emerald-400 animate-ping-slow'
                  : wsStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500'
              }`} />
              <span className="text-[11px] font-mono text-slate-300 hidden md:inline">
                {wsStatus === 'connected' ? 'WS Live' : wsStatus === 'connecting' ? 'WS Syncing' : 'WS Offline'}
              </span>
            </div>

            {/* Reseed Demo Button */}
            <button
              onClick={onReseed}
              title="Reseed Realistic Demo Incidents"
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
