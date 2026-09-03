import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import InstantReport from './components/Requester/InstantReport';
import EnrichmentForm from './components/Requester/EnrichmentForm';
import LiveStatusTracker from './components/Requester/LiveStatusTracker';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminMap from './components/Admin/AdminMap';
import ZoneReportScreen from './components/ZoneReport/ZoneReportScreen';
import VolunteerMock from './components/Simulation/VolunteerMock';
import { CrisisWebSocketClient } from './services/websocket';
import { api } from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState('requester');
  const [requesterStep, setRequesterStep] = useState('report'); // 'report', 'enrichment', 'status'
  const [activeRequest, setActiveRequest] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');

  // Maintain global WebSocket connection for connection badge
  useEffect(() => {
    const wsClient = new CrisisWebSocketClient(
      'admin',
      'all',
      () => {},
      (status) => setWsStatus(status)
    );
    return () => wsClient.close();
  }, []);

  const handleRequestCreated = (newReq) => {
    setActiveRequest(newReq);
    setRequesterStep('enrichment');
  };

  const handleEnrichmentComplete = (updatedReq) => {
    setActiveRequest(updatedReq);
    setRequesterStep('status');
  };

  const handleEnrichmentSkip = () => {
    setRequesterStep('status');
  };

  const handleStartNewRequest = () => {
    setActiveRequest(null);
    setRequesterStep('report');
  };

  const handleReseed = async () => {
    if (window.confirm('Reset and reseed demo crisis data?')) {
      try {
        await api.reseed();
        alert('Demo data reseeded with realistic emergency scenarios!');
        window.location.reload();
      } catch (err) {
        alert('Reseed error: ' + err.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        wsStatus={wsStatus}
        onReseed={handleReseed}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Requester Tab */}
        {currentTab === 'requester' && (
          <div>
            {requesterStep === 'report' && (
              <InstantReport onRequestCreated={handleRequestCreated} />
            )}

            {requesterStep === 'enrichment' && activeRequest && (
              <EnrichmentForm
                request={activeRequest}
                onComplete={handleEnrichmentComplete}
                onSkip={handleEnrichmentSkip}
              />
            )}

            {requesterStep === 'status' && activeRequest && (
              <LiveStatusTracker
                initialRequest={activeRequest}
                onNewRequest={handleStartNewRequest}
              />
            )}
          </div>
        )}

        {/* Admin Queue Triage Tab */}
        {currentTab === 'admin' && (
          <AdminDashboard onOpenMap={() => setCurrentTab('admin-map')} />
        )}

        {/* Admin Crisis GIS Map Tab */}
        {currentTab === 'admin-map' && (
          <AdminMap />
        )}

        {/* Crisis Zone Pin-Drop Tab */}
        {currentTab === 'zone-report' && (
          <ZoneReportScreen
            onReportSubmitted={(res) => {
              if (res.confirmed_zone) {
                // If a new zone was confirmed, prompt to see it on map
                if (window.confirm('🚨 Crisis Perimeter Confirmed! Would you like to view it on the Crisis Map?')) {
                  setCurrentTab('admin-map');
                }
              }
            }}
          />
        )}

        {/* Volunteer Simulator (Dev B Mock) */}
        {currentTab === 'simulator' && (
          <VolunteerMock />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        CrisisConnect Dev A Suite · FastAPI &bull; Native WebSockets &bull; Supabase Postgres &bull; React Vite Tailwind
      </footer>
    </div>
  );
}
