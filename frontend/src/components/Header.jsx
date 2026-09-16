import React, { useState } from 'react';
import webLogo from '../web-logo-new.jpg';
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
  UserCheck,
  Menu,
  X,
  Zap,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'requester', label: '1-Tap SOS', shortLabel: 'SOS', icon: AlertTriangle, mode: 'citizen', badge: 'Critical' },
    { id: 'admin', label: 'Triage Queue', shortLabel: 'Triage', icon: ShieldAlert, mode: 'ngo' },
    { id: 'admin-map', label: 'Live GIS Map', shortLabel: 'Live Map', icon: MapPin, mode: 'ngo' },
    { id: 'zone-report', label: 'Report Hazard', shortLabel: 'Hazards', icon: Radio, mode: 'citizen' },
    { id: 'simulator', label: 'Volunteer Mock', shortLabel: 'Volunteer', icon: Users, mode: 'dev' },
  ];

  const handleTabSelect = (tabId) => {
    onTabChange(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0F172A] border-b border-slate-800 shadow-md">
        
        {/* =========================================================================
            PERSISTENT TOP CALLOUT HEADING: "LOGIN AS A VOLUNTEER OR A NGO"
           ========================================================================= */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800/80 px-3 sm:px-4 py-1.5 sm:py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2">
            
            {!currentUser ? (
              /* Unauthenticated state: Prominent invitation */
              <div className="flex items-center space-x-2 text-slate-300 text-[11px] sm:text-xs">
                <span className="flex h-2 w-2 relative flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="font-medium truncate">
                  Are you a <strong className="text-white">Volunteer</strong> or <strong className="text-white">NGO Agency</strong>?
                </span>
              </div>
            ) : (
              /* Authenticated state: Verified badge & ID */
              <div className="flex items-center space-x-1.5 sm:space-x-2 text-emerald-400 font-bold text-[11px] sm:text-xs truncate">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-slate-200 truncate">
                  Verified {currentUser.role === 'volunteer' ? 'Volunteer' : 'NGO'}:
                </span>
                <span className="text-white px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-[10px] sm:text-[11px] font-mono truncate">
                  {currentUser.name}
                </span>
              </div>
            )}

            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-end">
              {!currentUser ? (
                <div className="flex items-center space-x-1.5 sm:space-x-2 w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    onClick={() => onOpenAuthModal('volunteer')}
                    className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-[10px] sm:text-[11px] transition shadow-xs flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Login Volunteer</span>
                  </button>

                  <button
                    onClick={() => onOpenAuthModal('ngo')}
                    className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white font-bold text-[10px] sm:text-[11px] transition shadow-xs flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Login NGO</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onTabChange(currentUser.role === 'volunteer' ? 'simulator' : 'admin')}
                    className="px-2.5 sm:px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-[10px] sm:text-[11px] transition flex items-center space-x-1 cursor-pointer"
                  >
                    <span>{currentUser.role === 'volunteer' ? 'Radar' : 'Control'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <button
                    onClick={onLogout}
                    title="Log out and switch role"
                    className="p-1 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition cursor-pointer"
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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            
            {/* Logo & Brand */}
            <div 
              className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group"
              onClick={() => handleTabSelect('requester')}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white p-0.5 sm:p-1 flex items-center justify-center shadow-md shadow-red-600/20 group-hover:scale-105 transition border border-slate-700/80 flex-shrink-0 overflow-hidden">
                <img 
                  src={webLogo} 
                  alt="CrisisConnect" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="font-extrabold text-base sm:text-xl tracking-tight text-white flex items-center">
                    Crisis<span className="text-red-500">Connect</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-950/80 text-red-300 border border-red-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                    <span>Disaster AI Mesh</span>
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none hidden md:flex items-center gap-1.5 mt-0.5">
                  <span>Autonomous Emergency Triage &amp; Volunteer Dispatch</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-emerald-400 font-mono text-[10px]">Mumbai Region</span>
                </p>
              </div>
            </div>

            {/* Desktop Navigation Tabs (Hidden on Mobile) */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    className={`relative flex items-center space-x-1.5 px-3 lg:px-3.5 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-sm border border-slate-600 ring-1 ring-white/10'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1 hidden lg:inline-block" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Controls: WS Status + Reseed Demo + Mobile Hamburger */}
            <div className="flex items-center space-x-2">
              {/* Live WebSocket Indicator */}
              <div 
                title={`WebSocket Status: ${wsStatus}`}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs shadow-inner"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  wsStatus === 'connected'
                    ? 'bg-emerald-400 beacon-radar-pulse'
                    : wsStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
                }`} />
                <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 font-bold hidden sm:inline">
                  {wsStatus === 'connected' ? 'WS Live' : wsStatus === 'connecting' ? 'Syncing' : 'Offline'}
                </span>
              </div>

              {/* Reseed Demo Button */}
              <button
                onClick={onReseed}
                title="Reseed Realistic Demo Incidents & Scenarios"
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Mobile Drawer Hamburger Button (Visible only on < md) */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
                className="md:hidden p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* =========================================================================
            MOBILE SLIDE-DOWN DRAWER MENU (When Hamburger is Clicked)
           ========================================================================= */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-2 animate-in slide-in-from-top-3 duration-200 shadow-2xl">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-1">
              Select Application View
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 text-white border border-slate-600 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded-lg ${isActive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{tab.label}</span>
                    </div>

                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase">
                        Active
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Mobile Role Login Strip */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              {!currentUser ? (
                <>
                  <button
                    onClick={() => { onOpenAuthModal('volunteer'); setIsMobileMenuOpen(false); }}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold text-center transition flex items-center justify-center space-x-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Volunteer Login</span>
                  </button>
                  <button
                    onClick={() => { onOpenAuthModal('ngo'); setIsMobileMenuOpen(false); }}
                    className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold text-center transition flex items-center justify-center space-x-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>NGO Login</span>
                  </button>
                </>
              ) : (
                <div className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-xs text-slate-300">
                    Signed in as: <strong className="text-white">{currentUser.name}</strong>
                  </div>
                  <button
                    onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
                    className="px-2.5 py-1 rounded-lg bg-red-950/80 text-red-300 border border-red-500/40 text-xs font-bold"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </header>

      {/* =========================================================================
          PERSISTENT MOBILE BOTTOM APP NAVIGATION BAR (Native App Feel on Phones)
         ========================================================================= */}
      <nav 
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F172A]/95 backdrop-blur-md border-t border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] pb-safe"
      >
        <div className="grid grid-cols-5 h-15 max-w-lg mx-auto px-1 items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            const isSos = tab.id === 'requester';

            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-0.5 transition-all duration-150 rounded-xl cursor-pointer ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Active Pill Glow Indicator */}
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 bg-red-500 rounded-full" />
                )}

                <div className={`relative p-1 rounded-xl transition-all ${
                  isActive 
                    ? (isSos ? 'bg-red-600 text-white shadow-md shadow-red-600/40 scale-110' : 'bg-slate-800 text-white shadow-xs') 
                    : ''
                }`}>
                  <Icon className={`w-5 h-5 ${isSos && !isActive ? 'text-red-400' : ''}`} />
                  {isSos && isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-white animate-ping" />
                  )}
                </div>

                <span className={`text-[10px] tracking-tight mt-0.5 ${
                  isActive ? 'font-black text-white' : 'font-semibold text-slate-400'
                }`}>
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

