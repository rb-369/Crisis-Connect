import * as maplibregl from 'maplibre-gl';

// SVG Icons for clean crisp rendering inside MapLibre DOM markers
const ICONS = {
  hazard: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `,
  sos: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  `,
  emergency: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v20M2 12h20"/>
    </svg>
  `,
  volunteer: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  `,
  completed: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  `,
  blood: `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  `
};

/**
 * Category to Color Map
 */
export const CATEGORY_COLORS = {
  rescue: '#991B1B',
  blood: '#DC2626',
  oxygen: '#0891B2',
  medicine: '#2563EB',
  food: '#D97706',
  shelter: '#7C3AED',
  transport: '#0D9488',
  general: '#DC2626',
};

/**
 * Determine Pin Type
 * Returns: 'hazard' | 'critical_sos' | 'normal_emergency' | 'assigned_volunteer' | 'completed'
 */
export function getPinType(item) {
  if (item.isSachetAlert || item.isHazard) return 'hazard';
  if (item.status === 'completed' || item.status === 'resolved') return 'completed';
  if (item.status === 'matched' || item.status === 'en_route' || item.status === 'in_progress') {
    return 'assigned_volunteer';
  }
  if (item.urgency === 'high' || item.urgency === 'critical' || item.is_sos) {
    return 'critical_sos';
  }
  return 'normal_emergency';
}

/**
 * Create a Custom Pin DOM Element & MapLibre Marker
 */
export function createMapLibrePin({
  item,
  type = getPinType(item),
  onSelect,
  onExpire, // Callback when 2-minute timer for completed pin finishes
  onManualRemove, // Callback for manual remove action
}) {
  // Outer Container: MapLibre GL JS controls position: absolute and transform: translate(x,y)
  const container = document.createElement('div');
  container.className = 'maplibregl-marker maplibre-custom-pin-anchor';
  container.style.width = '44px';
  container.style.height = '44px';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.userSelect = 'none';

  // Inner Pin Content Wrapper (allows relative positioning for badges)
  const pinWrapper = document.createElement('div');
  pinWrapper.className = 'maplibre-pin-content';
  pinWrapper.style.position = 'relative';
  pinWrapper.style.display = 'flex';
  pinWrapper.style.flexDirection = 'column';
  pinWrapper.style.alignItems = 'center';
  pinWrapper.style.justifyContent = 'center';

  // Inner Pin Bubble
  const pinBubble = document.createElement('div');
  pinBubble.className = 'maplibre-pin-bubble';
  pinBubble.style.display = 'flex';
  pinBubble.style.alignItems = 'center';
  pinBubble.style.justifyContent = 'center';
  pinBubble.style.borderRadius = '50%';
  pinBubble.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
  pinBubble.style.zIndex = '2';

  let timerInterval = null;
  let expireTimeout = null;

  // 1. HAZARD PIN (Amber/Orange Warning Triangle / Shield)
  if (type === 'hazard') {
    const severity = item.severity || (item.properties?.severity) || 'Severe';
    const severityColor =
      severity === 'Extreme' ? '#DC2626' : severity === 'Severe' ? '#EA580C' : '#EAB308';

    pinBubble.style.width = '38px';
    pinBubble.style.height = '38px';
    pinBubble.style.backgroundColor = severityColor;
    pinBubble.style.border = '3px solid #FFFFFF';
    pinBubble.style.boxShadow = `0 4px 14px ${severityColor}99`;
    pinBubble.classList.add('pin-hazard');
    pinBubble.innerHTML = ICONS.hazard;

    // Severity Tag
    const tag = document.createElement('div');
    tag.style.position = 'absolute';
    tag.style.bottom = '-18px';
    tag.style.backgroundColor = '#0F172A';
    tag.style.color = '#FFFFFF';
    tag.style.fontSize = '9px';
    tag.style.fontWeight = '900';
    tag.style.letterSpacing = '0.5px';
    tag.style.textTransform = 'uppercase';
    tag.style.padding = '1px 5px';
    tag.style.borderRadius = '4px';
    tag.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    tag.style.whiteSpace = 'nowrap';
    tag.style.zIndex = '3';
    tag.innerText = `⚠️ ${severity}`;
    pinWrapper.appendChild(tag);
  }

  // 2. CRITICAL SOS (Glowing Red Pin with High Urgency Radar Glow)
  else if (type === 'critical_sos') {
    pinBubble.style.width = '42px';
    pinBubble.style.height = '42px';
    pinBubble.style.backgroundColor = '#DC2626';
    pinBubble.style.border = '3.5px solid #FFFFFF';
    pinBubble.style.boxShadow = '0 0 16px rgba(220, 38, 38, 0.9)';
    pinBubble.classList.add('pin-critical-sos');
    pinBubble.innerHTML = ICONS.sos;

    // SOS Floating Badge
    const sosBadge = document.createElement('div');
    sosBadge.style.position = 'absolute';
    sosBadge.style.top = '-14px';
    sosBadge.style.backgroundColor = '#991B1B';
    sosBadge.style.border = '1.5px solid #FFFFFF';
    sosBadge.style.color = '#FFFFFF';
    sosBadge.style.fontSize = '9px';
    sosBadge.style.fontWeight = '900';
    sosBadge.style.padding = '1px 6px';
    sosBadge.style.borderRadius = '9999px';
    sosBadge.style.boxShadow = '0 2px 8px rgba(153, 27, 27, 0.7)';
    sosBadge.style.whiteSpace = 'nowrap';
    sosBadge.style.zIndex = '3';
    sosBadge.innerText = 'CRITICAL SOS';
    pinWrapper.appendChild(sosBadge);
  }

  // 3. NORMAL EMERGENCY (Solid Red Emergency Pin)
  else if (type === 'normal_emergency') {
    const catColor = CATEGORY_COLORS[item.category] || '#DC2626';
    pinBubble.style.width = '34px';
    pinBubble.style.height = '34px';
    pinBubble.style.backgroundColor = catColor;
    pinBubble.style.border = '2.5px solid #FFFFFF';
    pinBubble.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.35)';
    pinBubble.classList.add('pin-urgent-radar');
    pinBubble.innerHTML = item.category === 'blood' ? ICONS.blood : ICONS.emergency;

    // Category Label
    const catBadge = document.createElement('div');
    catBadge.style.position = 'absolute';
    catBadge.style.bottom = '-16px';
    catBadge.style.backgroundColor = '#1E293B';
    catBadge.style.color = '#FFFFFF';
    catBadge.style.fontSize = '9px';
    catBadge.style.fontWeight = '800';
    catBadge.style.textTransform = 'uppercase';
    catBadge.style.padding = '1px 5px';
    catBadge.style.borderRadius = '4px';
    catBadge.style.whiteSpace = 'nowrap';
    catBadge.style.zIndex = '3';
    catBadge.innerText = item.category || 'SOS';
    pinWrapper.appendChild(catBadge);
  }

  // 4. ASSIGNED VOLUNTEER (Vibrant Blue Responder Pin)
  else if (type === 'assigned_volunteer') {
    pinBubble.style.width = '38px';
    pinBubble.style.height = '38px';
    pinBubble.style.backgroundColor = '#2563EB';
    pinBubble.style.border = '3px solid #FFFFFF';
    pinBubble.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.6)';
    pinBubble.classList.add('pin-volunteer');
    pinBubble.innerHTML = ICONS.volunteer;

    // Assigned Volunteer Tag
    const volBadge = document.createElement('div');
    volBadge.style.position = 'absolute';
    volBadge.style.bottom = '-18px';
    volBadge.style.backgroundColor = '#1D4ED8';
    volBadge.style.color = '#FFFFFF';
    volBadge.style.fontSize = '9px';
    volBadge.style.fontWeight = '800';
    volBadge.style.padding = '1px 6px';
    volBadge.style.borderRadius = '4px';
    volBadge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    volBadge.style.whiteSpace = 'nowrap';
    volBadge.style.zIndex = '3';
    volBadge.innerText = 'DISPATCHED';
    pinWrapper.appendChild(volBadge);
  }

  // 5. COMPLETED PIN (Green Pin with 2-Minute Timer then Auto-Remove)
  else if (type === 'completed') {
    pinBubble.style.width = '36px';
    pinBubble.style.height = '36px';
    pinBubble.style.backgroundColor = '#16A34A';
    pinBubble.style.border = '3px solid #FFFFFF';
    pinBubble.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.5)';
    pinBubble.classList.add('pin-completed');
    pinBubble.innerHTML = ICONS.completed;

    // Dynamic 2-Minute Timer Badge (120 seconds)
    const TOTAL_LIFESPAN_MS = 120 * 1000;
    const completedAt = item.completed_at ? new Date(item.completed_at).getTime() : Date.now();
    const elapsed = Math.max(0, Date.now() - completedAt);
    let remainingMs = Math.max(0, TOTAL_LIFESPAN_MS - elapsed);

    const timerBadge = document.createElement('div');
    timerBadge.style.position = 'absolute';
    timerBadge.style.bottom = '-18px';
    timerBadge.style.backgroundColor = '#15803D';
    timerBadge.style.color = '#FFFFFF';
    timerBadge.style.fontSize = '9px';
    timerBadge.style.fontWeight = '800';
    timerBadge.style.padding = '1px 6px';
    timerBadge.style.borderRadius = '4px';
    timerBadge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    timerBadge.style.whiteSpace = 'nowrap';
    timerBadge.style.zIndex = '3';

    const updateTimerText = () => {
      const remainingSec = Math.ceil(remainingMs / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      timerBadge.innerText = `✓ RESOLVED (${mins}:${secs < 10 ? '0' : ''}${secs})`;
    };

    updateTimerText();
    pinWrapper.appendChild(timerBadge);

    // Fade out and remove function
    const triggerExpiry = () => {
      if (container) {
        container.classList.add('pin-fade-out-anim');
      }
      setTimeout(() => {
        if (onExpire) onExpire(item.id);
      }, 1200);
    };

    if (remainingMs <= 0) {
      triggerExpiry();
    } else {
      timerInterval = setInterval(() => {
        remainingMs -= 1000;
        if (remainingMs <= 0) {
          clearInterval(timerInterval);
          triggerExpiry();
        } else {
          updateTimerText();
        }
      }, 1000);

      expireTimeout = setTimeout(() => {
        triggerExpiry();
      }, remainingMs);
    }
  }

  pinWrapper.appendChild(pinBubble);
  container.appendChild(pinWrapper);

  // Click handler
  container.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(item, type);
  });

  // Hover animations
  container.addEventListener('mouseenter', () => {
    pinBubble.style.transform = 'scale(1.15) translateY(-2px)';
  });
  container.addEventListener('mouseleave', () => {
    pinBubble.style.transform = 'scale(1) translateY(0)';
  });

  // Extract coordinates (GeoJSON [lng, lat] or request lat/lng)
  const lat = parseFloat(item.lat !== undefined ? item.lat : (item.properties?.lat || 19.076));
  const lng = parseFloat(item.lng !== undefined ? item.lng : (item.properties?.lng || 72.877));

  const marker = new maplibregl.Marker({ element: container, anchor: 'center' }).setLngLat([
    lng,
    lat,
  ]);

  // Cleanup helper
  const destroy = () => {
    if (timerInterval) clearInterval(timerInterval);
    if (expireTimeout) clearTimeout(expireTimeout);
    marker.remove();
  };

  return {
    marker,
    element: container,
    type,
    destroy,
  };
}

/**
 * Centroid calculation for Sachet Polygons to drop Hazard Centroid Pins
 */
export function calculatePolygonCentroid(coordinates) {
  if (!coordinates || !coordinates.length) return null;
  const ring = coordinates[0];
  let sumLng = 0;
  let sumLat = 0;
  for (let i = 0; i < ring.length; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }
  return [sumLng / ring.length, sumLat / ring.length];
}
