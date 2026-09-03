import React from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Radio, 
  Activity, 
  RotateCcw,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function Header({ currentTab, onTabChange, wsStatus, onReseed }) {
  const tabs = [
    { id: 'requester', label: '1-Tap SOS (Citizen)', icon: AlertTriangle, mode: 'citizen' },
    { id: 'admin', label: 'Triage Queue', icon: ShieldAlert, mode: 'ngo' },
    { id: 'admin-map', label: 'Live GIS Map', icon: MapPin, mode: 'ngo' },
    { id: 'zone-report', label: 'Report Hazard', icon: Radio, mode: 'citizen' },
    { id: 'simulator', label: 'Volunteer Mock', icon: Users, mode: 'dev' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0F172A] border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => onTabChange('requester')}
          >
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-md shadow-red-600/30 group-hover:scale-105 transition">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  Crisis<span className="text-red-500">Connect</span>
                </span>
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  Dev A Stack
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none hidden md:block">
                Emergency Triage & Community Aid Dispatch
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
