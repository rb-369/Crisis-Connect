"""Static NDMA-Sachet-style hazard polygon overlay for the admin GIS map.

Purely presentational demo data (Mumbai), ported from Dev A's frontend design
so the map has something to render zones against. Not wired to any live feed
-- CAP GeoJSON ingestion is out of scope for the MVP build window.
"""
from datetime import datetime, timezone

_NOW = datetime.now(timezone.utc).isoformat()

MUMBAI_SACHET_ALERTS = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "sachet-mum-001",
            "properties": {
                "headline": "Mithi River Basin Flash Flood & Overflow Warning",
                "category": "Flood",
                "severity": "Extreme",
                "district": "Mumbai Suburban (Kurla - Kalina)",
                "state": "Maharashtra",
                "description": "Brimstowd pumping gates saturated. Mithi river level 3.8m "
                               "exceeding danger mark. Immediate evacuation along Kranti "
                               "Nagar and Kurla West.",
                "effective": _NOW,
                "expires": "2026-09-04T18:00:00Z",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [72.8650, 19.0600], [72.8900, 19.0620], [72.8950, 19.0800],
                    [72.8700, 19.0850], [72.8600, 19.0720], [72.8650, 19.0600],
                ]],
            },
        },
        {
            "type": "Feature",
            "id": "sachet-mum-002",
            "properties": {
                "headline": "Mahim Bay & Coastal Tidal Surge Advisory",
                "category": "Cyclone / Surge",
                "severity": "Severe",
                "district": "Mumbai City (Bandra - Dadar Coast)",
                "state": "Maharashtra",
                "description": "High tide of 4.65m combined with squally winds 55-65 kmph. "
                               "Avoid promenade and low-lying coastal roads.",
                "effective": _NOW,
                "expires": "2026-09-04T12:00:00Z",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [72.8150, 19.0200], [72.8400, 19.0300], [72.8450, 19.0650],
                    [72.8250, 19.0600], [72.8150, 19.0200],
                ]],
            },
        },
        {
            "type": "Feature",
            "id": "sachet-mum-003",
            "properties": {
                "headline": "Hindmata - Sion Waterlogging & Transit Disruption",
                "category": "Heavy Rain",
                "severity": "Moderate",
                "district": "Mumbai Central (Sion - Matunga - Parel)",
                "state": "Maharashtra",
                "description": "Continuous precipitation leading to 1.5ft water "
                               "accumulation. BEST buses diverted via Dr. B.A. Road flyover.",
                "effective": _NOW,
                "expires": "2026-09-04T08:00:00Z",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [72.8400, 19.0050], [72.8650, 19.0150], [72.8700, 19.0450],
                    [72.8450, 19.0400], [72.8400, 19.0050],
                ]],
            },
        },
    ],
}
