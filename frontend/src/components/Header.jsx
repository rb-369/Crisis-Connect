import React from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Radio, 
  Activity, 
  RotateCcw,
  Users
} from 'lucide-react';

export default function Header({ currentTab, onTabChange, wsStatus, onReseed }) {
  const tabs = [
    { id: 'requester', label: '1-Tap Requester', icon: AlertTriangle, badge: 'Citizen' },
    { id: 'admin', label: 'Admin Triage', icon: ShieldAlert, badge: 'NGO' },
    { id: 'admin-map', label: 'Crisis Map', icon: MapPin, badge: 'Live GIS' },
    { id: 'zone-report', label: 'Report Hazard', icon: Radio, badge: 'Crowdsource' },
    { id: 'simulator', label: 'Volunteer Simulator', icon: Users, badge: 'Dev B Mock' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange('requester')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Activity className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  Crisis<span className="text-red-500">Connect</span>
                </span>
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                  Dev A Stack
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none hidden sm:block">
                FastAPI + Native WebSockets + React + Supabase
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-1 max-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`hidden md:inline-block text-[9px] px-1 py-0.2 rounded font-mono ${
                      isActive ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status & Tools */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Live WebSocket Indicator */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
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

            {/* Reseed Button */}
            <button
              onClick={onReseed}
              title="Reseed Realistic Demo Data"
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
