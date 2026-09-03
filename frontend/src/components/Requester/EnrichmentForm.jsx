import React, { useState } from 'react';
import { User, Phone, FileText, Image, ArrowRight, SkipForward, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

export default function EnrichmentForm({ request, onComplete, onSkip }) {
  const [formData, setFormData] = useState({
    requester_name: request.requester_name || '',
    requester_phone: request.requester_phone || '',
    details: request.details || '',
    photo_url: request.photo_url || '',
  });
  const [isSaving, setIsSaving] = useState(false);

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
      // Even if failed, continue to status screen
      onComplete(request);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-6 px-4">
      {/* Success Badge */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">SOS Broadcasted Live!</h4>
            <p className="text-xs text-emerald-300/80">
              Responders can already see your location for <span className="font-semibold uppercase">{request.category}</span> aid.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Step 2: Add Details (Optional)</h2>
            <p className="text-xs text-slate-400">Help volunteers identify you faster. You can skip this anytime.</p>
          </div>
          <button
            onClick={onSkip}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center space-x-1"
          >
            <span>Skip Form</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Contact Name (Optional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={formData.requester_name}
                onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                placeholder="e.g., Jane Doe / Floor 3 Resident"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Contact Phone / WhatsApp (Optional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="tel"
                value={formData.requester_phone}
                onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
                placeholder="e.g., +1 555-0123"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Specific Situation / Landmark / Notes (Optional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <textarea
                rows={3}
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="e.g., Blue house near church, 2 people need transport..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Photo URL (Optional)
            </label>
            <div className="relative">
              <Image className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="url"
                value={formData.photo_url}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                placeholder="https://..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition"
            >
              Skip to Status
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-1/2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold shadow-lg shadow-red-600/30 transition flex items-center justify-center space-x-1.5"
            >
              <span>{isSaving ? 'Saving...' : 'Save & Track'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
