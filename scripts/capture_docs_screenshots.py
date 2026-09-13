import os
import time
import json
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.join(os.getcwd(), "docs", "ss")
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_URL = "http://localhost:5173"

def run():
    print(f"Starting screenshot automation -> saving to {OUTPUT_DIR}")
    
    with sync_playwright() as p:
        # Launch browser with msedge
        browser = p.chromium.launch(
            channel="msedge",
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        
        # Context with 2x device scale for high-DPI crisp screenshots
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2
        )
        
        page = context.new_page()
        
        # -------------------------------------------------------------
        # 1. Citizen 1-Tap SOS Screen
        # -------------------------------------------------------------
        print("Capturing 01_citizen_instant_sos.png...")
        page.goto(BASE_URL)
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "01_citizen_instant_sos.png"), full_page=False)
        
        # -------------------------------------------------------------
        # 2. Active SOS Beacon Tracking Screen
        # -------------------------------------------------------------
        print("Capturing 02_sos_active_beacon_tracking.png...")
        # Calibrate to KEM Hospital
        try:
            page.click("button:has-text('🏥 KEM Hospital')", timeout=3000)
            page.wait_for_timeout(500)
        except Exception as e:
            print(f"Preset click warning: {e}")
            
        # Click Master Emergency SOS
        try:
            page.click("h1:has-text('EMERGENCY SOS')", timeout=3000)
            page.wait_for_timeout(2500)
            page.screenshot(path=os.path.join(OUTPUT_DIR, "02_sos_active_beacon_tracking.png"), full_page=False)
        except Exception as e:
            print(f"SOS trigger warning: {e}")
            
        # -------------------------------------------------------------
        # 3. Emergency Cancellation Modal
        # -------------------------------------------------------------
        print("Capturing 03_emergency_cancellation_flow.png...")
        try:
            page.click("button:has-text('Cancel Emergency (False Alarm)')", timeout=3000)
            page.wait_for_timeout(1000)
            page.screenshot(path=os.path.join(OUTPUT_DIR, "03_emergency_cancellation_flow.png"), full_page=False)
            # Dismiss modal
            page.click("button:has-text('Keep Active')", timeout=2000)
            page.wait_for_timeout(500)
        except Exception as e:
            print(f"Cancel modal warning: {e}")

        # -------------------------------------------------------------
        # 4. NGO Triage Queue (Unauthenticated / Telemetry & Locks)
        # -------------------------------------------------------------
        print("Capturing 04_ngo_triage_queue_telemetry.png...")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_timeout(1000)
        page.click("button:has-text('Triage Queue')")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "04_ngo_triage_queue_telemetry.png"), full_page=False)

        # -------------------------------------------------------------
        # 5. NGO Admin Authenticated View (Moderation Unlocked)
        # -------------------------------------------------------------
        print("Capturing 05_ngo_admin_authenticated_dispatch.png...")
        ngo_user = {
            "id": "NGO-MUM-88",
            "role": "ngo",
            "name": "Disaster Relief India (DARPAN Vetted)",
            "darpan_id": "MH/2021/0289114",
            "verified": True
        }
        page.evaluate(f"localStorage.setItem('crisis_connect_user', JSON.stringify({json.dumps(ngo_user)}))")
        page.reload()
        page.wait_for_timeout(1000)
        page.click("button:has-text('Triage Queue')")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "05_ngo_admin_authenticated_dispatch.png"), full_page=False)

        # -------------------------------------------------------------
        # 6. Live GIS Crisis & Hazard Map
        # -------------------------------------------------------------
        print("Capturing 06_live_crisis_gis_map.png...")
        page.click("button:has-text('Live GIS Map')")
        # Give MapLibre GL tiles time to render
        page.wait_for_timeout(3500)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "06_live_crisis_gis_map.png"), full_page=False)

        # -------------------------------------------------------------
        # 7. Volunteer Mock Priority Feed
        # -------------------------------------------------------------
        print("Capturing 07_volunteer_responder_radar.png...")
        vol_user = {
            "id": "VOL-1002",
            "role": "volunteer",
            "name": "Vikram Joshi",
            "badge": "Universal Blood Donor (O-)",
            "skills": ["blood_donor", "first_aid"],
            "verified": True
        }
        page.evaluate(f"localStorage.setItem('crisis_connect_user', JSON.stringify({json.dumps(vol_user)}))")
        page.reload()
        page.wait_for_timeout(1000)
        page.click("button:has-text('Volunteer Mock')")
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "07_volunteer_responder_radar.png"), full_page=False)

        # -------------------------------------------------------------
        # 7b. Volunteer Mock Map View (Clean Corner Pin Verified)
        # -------------------------------------------------------------
        print("Capturing 07b_volunteer_radar_map.png...")
        try:
            page.click("button:has-text('MapLibre Map')")
            page.wait_for_timeout(3500)
            page.screenshot(path=os.path.join(OUTPUT_DIR, "07b_volunteer_radar_map.png"), full_page=False)
        except Exception as e:
            print(f"Volunteer map toggle warning: {e}")

        # -------------------------------------------------------------
        # 8. Crowdsourced Hazard & Flood Zone Report
        # -------------------------------------------------------------
        print("Capturing 08_crowdsourced_hazard_zones.png...")
        page.click("button:has-text('Report Hazard')")
        page.wait_for_timeout(1500)
        # Click Mumbai preset hazard chip if present
        try:
            page.click("button:has-text('🌊 Kurla Flooding')", timeout=2000)
            page.wait_for_timeout(800)
        except Exception as e:
            print(f"Hazard preset warning: {e}")
        page.screenshot(path=os.path.join(OUTPUT_DIR, "08_crowdsourced_hazard_zones.png"), full_page=False)

        # -------------------------------------------------------------
        # 9. Multi-Step Auth & Onboarding Modal
        # -------------------------------------------------------------
        print("Capturing 09_auth_verification_modal.png...")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_timeout(1000)
        page.click("button:has-text('Login as NGO')")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "09_auth_verification_modal.png"), full_page=False)

        browser.close()
        print("All screenshots successfully captured!")

if __name__ == "__main__":
    run()
