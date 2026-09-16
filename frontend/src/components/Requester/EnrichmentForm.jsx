import React, { useState } from 'react';
import { User, Phone, FileText, Image, Video, Camera, ArrowRight, SkipForward, CheckCircle2, ShieldCheck, X, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

export default function EnrichmentForm({ request, onComplete, onSkip, onCancelEmergency }) {
  const [formData, setFormData] = useState({
    requester_name: request.requester_name || '',
    requester_phone: request.requester_phone || '',
    details: request.details || '',
    photo_url: request.photo_url || '',
  });
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isVideoProof, setIsVideoProof] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const isCritical = request.urgency === 'high';

  // Handle live camera video or photo capture directly from device
  const handleMediaCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video');
    setIsVideoProof(isVideo);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setMediaPreview(dataUrl);
      setFormData((prev) => ({
        ...prev,
        photo_url: `[Verified ${isVideo ? 'Video' : 'Photo'} Proof Attached: ${file.name}]`,
      }));
    };
    reader.readAsDataURL(file);
  };

  const clearMedia = () => {
    setMediaPreview(null);
    setIsVideoProof(false);
    setFormData((prev) => ({ ...prev, photo_url: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.patchRequest(request.id, {
        requester_name: formData.requester_name || null,
        requester_phone: formData.requester_phone || null,
        details: formData.details || null,
        photo_url: formData.photo_url || null,
      });
      onComplete(updated);
    } catch (err) {
      console.error('Enrichment patch failed:', err);
      onComplete(request);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      if (onCancelEmergency) {
        await onCancelEmergency(request.id, 'Accidental trigger during enrichment');
      } else {
        await api.cancelRequest(request.id, 'Accidental trigger during enrichment');
      }
    } catch (err) {
      console.error('Cancellation error:', err);
      if (onSkip) onSkip();
    } finally {
      setIsCancelling(false);
      setIsCancelModalOpen(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4 sm:py-8 px-2">
      {/* Reassurance Confirmation Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3 sm:space-x-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-emerald-900 text-xs sm:text-base">
              Request Broadcasted to Responders!
            </h4>
            <p className="text-[11px] sm:text-xs text-emerald-700 font-medium mt-0.5">
              Live coordinates active for <strong className="uppercase">{request.category}</strong> relief.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCancelModalOpen(true)}
          className="self-end sm:self-auto text-xs font-bold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 px-3 py-1.5 rounded-xl border border-red-200 transition flex items-center space-x-1 cursor-pointer shadow-xs"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Cancel Emergency</span>
        </button>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-slate-200 p-4 sm:p-7 rounded-2xl shadow-xs">
        <div className="flex items-start sm:items-center justify-between border-b border-slate-200 pb-4 mb-5 gap-2">
          <div>
            <h2 className="text-base sm:text-xl font-extrabold text-slate-900 leading-snug">
              Step 2: Add Contact &amp; Details
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
              Help responders locate you faster. Skippable anytime.
            </p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={onSkip}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center space-x-1 cursor-pointer"
            >
              <span>Skip</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Your Name or Contact Person (Optional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={formData.requester_name}
                onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                placeholder="e.g., Rajesh Sharma / Floor 2 Resident"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Phone / WhatsApp Number (Optional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="tel"
                value={formData.requester_phone}
                onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
                placeholder="e.g., +91 98201 12345"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Specific Situation / Landmark / Critical Needs (Optional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <textarea
                rows={3}
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="e.g., Water level rising near ground floor; need drinking water cans & insulin storage."
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Photo / Video Verification Proof Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Attach On-Scene Photo or Video Proof (Optional)
            </label>
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-2xl hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 cursor-pointer transition">
              <div className="flex items-center space-x-2 text-slate-600 font-bold text-xs">
                <Camera className="w-5 h-5 text-blue-600" />
                <span>Snap Camera Photo or Video Proof</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 font-medium">
                Helps dispatchers authenticate your request and prioritize medical teams
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                capture="environment"
                onChange={handleMediaCapture}
                className="hidden"
              />
            </label>

            {mediaPreview && (
              <div className="mt-3 p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {isVideoProof ? (
                    <video src={mediaPreview} className="w-12 h-12 rounded-lg object-cover bg-black flex-shrink-0" />
                  ) : (
                    <img src={mediaPreview} alt="Proof" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isVideoProof ? 'Video Evidence' : 'Photo Evidence'} Attached</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {isVideoProof ? 'Live Video Recording (Authentic Scene)' : 'Live Camera Photo (On-Site Capture)'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearMedia}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-700 transition"
                  title="Remove proof"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold transition cursor-pointer text-center"
            >
              Skip to Live Status
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`w-full sm:w-1/2 py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                isCritical
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
              }`}
            >
              <span>{isSaving ? 'Saving...' : 'Save & Track Live'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(true)}
              className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline inline-flex items-center space-x-1 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Accidentally pressed? Cancel this emergency</span>
            </button>
          </div>
        </form>
      </div>

      {/* Accidental Cancel Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-3 sm:mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <h3 className="text-lg sm:text-xl font-black text-slate-900 text-center tracking-tight">
              Cancel Emergency Request?
            </h3>

            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              Are you sure you want to cancel this request? It will be immediately removed from the volunteer feed, triage queue, and live crisis map.
            </p>

            <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setIsCancelModalOpen(false)}
                className="w-full sm:w-auto py-2.5 sm:py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer text-center"
              >
                Keep Active
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="w-full sm:flex-1 py-2.5 sm:py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 shadow-md shadow-red-600/20"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Yes, Cancel Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
