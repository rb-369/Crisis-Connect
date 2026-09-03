import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import InstantReport from './components/Requester/InstantReport';
import EnrichmentForm from './components/Requester/EnrichmentForm';
import LiveStatusTracker from './components/Requester/LiveStatusTracker';
import SosStatusView from './components/Critical/SosStatusView';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminMap from './components/Admin/AdminMap';
import ZoneReportScreen from './components/ZoneReport/ZoneReportScreen';
import VolunteerMock from './components/Simulation/VolunteerMock';
import MultiStepAuthModal from './components/Auth/MultiStepAuthModal';
import { CrisisWebSocketClient } from './services/websocket';
import { api } from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState('requester');
  const [requesterStep, setRequesterStep] = useState('report'); // 'report', 'enrichment', 'status'
  const [activeRequest, setActiveRequest] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');

  // Multi-step Auth state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalDefaultRole, setAuthModalDefaultRole] = useState('volunteer');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('crisis_connect_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Maintain global WebSocket connection for connection badge and match sync
  useEffect(() => {
    const wsClient = new CrisisWebSocketClient(
      'admin',
      'all',
      (payload) => {
        if (payload.event === 'matched' && payload.data) {
          setActiveRequest((prev) => {
            if (prev && prev.id === payload.data.id) {
              setRequesterStep('status');
              return { ...prev, ...payload.data };
            }
            return prev;
          });
        }
      },
      (status) => setWsStatus(status)
    );
    return () => wsClient.close();
  }, []);

  const handleRequestCreated = (newReq) => {
    setActiveRequest(newReq);
    // If it's a critical SOS or blood request with complete details, advance directly to live status tracker
    if (newReq.__sos || (newReq.category === 'blood' && newReq.service_details?.blood_group)) {
      setRequesterStep('status');
    } else {
      setRequesterStep('enrichment');
    }
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

  const handleOpenAuthModal = (role = 'volunteer') => {
    setAuthModalDefaultRole(role);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (profile) => {
    setCurrentUser(profile);
    localStorage.setItem('crisis_connect_user', JSON.stringify(profile));
    if (profile.role === 'volunteer') {
      setCurrentTab('simulator');
    } else if (profile.role === 'ngo') {
      setCurrentTab('admin');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('crisis_connect_user');
  };

  const handleReseed = async () => {
    if (window.confirm('Reset and reseed demo crisis scenarios?')) {
      try {
        await api.reseed();
        alert('Demo data reseeded with realistic emergency scenarios!');
        window.location.reload();
      } catch (err) {
        alert('Reseed error: ' + err.message);
      }
    }
  };

  // Select canvas background depending on mode:
  // - Admin Mission Control -> Cool Slate 100 (#F1F5F9)
  // - Citizen Requester PWA -> Soft Daylight Grey (#F8FAFC)
  const isMissionControl = currentTab === 'admin' || currentTab === 'admin-map';
  const canvasBg = isMissionControl ? 'bg-[#F1F5F9]' : 'bg-[#F8FAFC]';

  return (
    <div className={`min-h-screen ${canvasBg} text-[#0F172A] flex flex-col font-sans transition-colors duration-200`}>
      {/* Dark Slate 900 Top Navigation Shell */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        wsStatus={wsStatus}
        onReseed={handleReseed}
        currentUser={currentUser}
        onOpenAuthModal={handleOpenAuthModal}
        onLogout={handleLogout}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:px-8">
        {/* Citizen 1-Tap Requester SOS */}
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
              activeRequest.__sos ? (
                <SosStatusView
                  result={activeRequest}
                  onReturnHome={handleStartNewRequest}
                />
              ) : (
                <LiveStatusTracker
                  initialRequest={activeRequest}
                  onNewRequest={handleStartNewRequest}
                />
              )
            )}
          </div>
        )}

        {/* NGO / Dispatch Triage Queue */}
        {currentTab === 'admin' && (
          <AdminDashboard 
            onOpenMap={() => setCurrentTab('admin-map')}
            currentUser={currentUser}
            onOpenAuthModal={() => handleOpenAuthModal('ngo')}
          />
        )}

        {/* Live GIS Crisis & Hazard Map */}
        {currentTab === 'admin-map' && (
          <AdminMap />
        )}

        {/* Public Crowdsourced Hazard Reporting */}
        {currentTab === 'zone-report' && (
          <ZoneReportScreen
            onReportSubmitted={(res) => {
              if (res.confirmed_zone) {
                if (window.confirm('🚨 Crisis Perimeter Confirmed! Would you like to view it on the Crisis Map?')) {
                  setCurrentTab('admin-map');
                }
              }
            }}
          />
        )}

        {/* Volunteer Mobile Simulator (Dev B Mock) */}
        {currentTab === 'simulator' && (
          <VolunteerMock 
            currentUser={currentUser}
            onOpenAuthModal={() => handleOpenAuthModal('volunteer')}
          />
        )}
      </main>

      {/* Multi-Step Authentication & Verification Modal for Volunteers & NGOs */}
      <MultiStepAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        defaultRole={authModalDefaultRole}
      />

      {/* Footer */}
      <footer className="border-t border-[#CBD5E1] bg-white py-4 px-6 text-center text-xs text-[#64748B] font-medium">
        CrisisConnect &bull; Emergency Coordination Platform &bull; FastAPI Native WebSockets &bull; Supabase PostgreSQL &bull; React Vite Tailwind
      </footer>
    </div>
  );
}
