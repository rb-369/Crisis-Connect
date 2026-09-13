# CrisisConnect — High-Resolution Screenshot Gallery

This directory contains high-definition (Retina 2x DPI, 1440×900) showcase screenshots of **CrisisConnect** for use in documentation, GitHub READMEs, and LinkedIn/social media portfolios.

---

### Screenshot Inventory

| # | File Name | Screen / Feature | Description |
|---|---|---|---|
| **01** | [`01_citizen_instant_sos.png`](./01_citizen_instant_sos.png) | **Citizen 1-Tap SOS Hero** | Life-critical SOS trigger button with tactical ripple radar rings, GPS location status bar, Mumbai hotspot presets (KEM Hospital, Kurla West), and Assistance Category cards. |
| **02** | [`02_sos_active_beacon_tracking.png`](./02_sos_active_beacon_tracking.png) | **Active SOS Beacon Tracking** | Live distress broadcast screen showing the SOS progression ladder, responder claim status, incident ID, and the top accidental cancellation warning bar. |
| **03** | [`03_emergency_cancellation_flow.png`](./03_emergency_cancellation_flow.png) | **Emergency Cancellation Modal** | Safety confirmation modal allowing users who pressed SOS by accident to immediately withdraw their distress beacon from the triage queue and crisis map. |
| **04** | [`04_ngo_triage_queue_telemetry.png`](./04_ngo_triage_queue_telemetry.png) | **NGO Triage Queue (Public / Locked)** | Mission Control dashboard with live operational telemetry (*Total in Queue*, *High Urgency SOS*, *Duplicate Clusters*, *Avg Dispatch ETA*), audio voice memo waveform, and RBAC lock badges for unauthenticated users. |
| **05** | [`05_ngo_admin_authenticated_dispatch.png`](./05_ngo_admin_authenticated_dispatch.png) | **NGO Admin Dispatch (Unlocked)** | Authenticated NGO dispatcher session showing Darpan-verified agency credentials and unlocked Approve / Flag / Reject / Expire / Dispatch actions. |
| **06** | [`06_live_crisis_gis_map.png`](./06_live_crisis_gis_map.png) | **Live GIS Crisis & Hazard Map** | Multi-layer MapLibre GL JS engine displaying dynamic incident pins, casualty indicators, responder routes, and active pin inspector feed across Mumbai. |
| **07** | [`07_volunteer_responder_radar.png`](./07_volunteer_responder_radar.png) | **Volunteer Priority Dispatch Feed** | Responder feed with Blood Transfusion Compatibility engine (O- universal donor matching), real-time distance calculations, and 1-tap dispatch claims. |
| **07b** | [`07b_volunteer_radar_map.png`](./07b_volunteer_radar_map.png) | **Volunteer Radar Map** | MapLibre vector radar displaying volunteer location, nearby SOS incidents, and turn-by-turn route navigation without any corner rendering glitches. |
| **08** | [`08_crowdsourced_hazard_zones.png`](./08_crowdsourced_hazard_zones.png) | **Crowdsourced Hazard Reporting** | Community hazard demarcation tool with quick disaster scenario presets (*🌊 Kurla Flooding*, *📍 Dadar TT*, *⚡ Andheri Grid*) and crowd-clustering thresholds. |
| **09** | [`09_auth_verification_modal.png`](./09_auth_verification_modal.png) | **Role-Based Auth & Verification** | Multi-step onboarding modal supporting Darpan-vetted NGO agencies and skilled volunteer first responders with pre-configured demo test accounts. |

---

### Automated Generation Script

All screenshots in this folder can be regenerated at any time by running:
```bash
python scripts/capture_docs_screenshots.py
```
*(Requires Playwright and Microsoft Edge or Chromium installed)*
