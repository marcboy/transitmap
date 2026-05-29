// TransitMap — TV D-pad Navigation
// Injected by build.js. Runs after all prototype code is defined.
// Provides city switching via remote control left/right arrows.

function initTVNav() {
  let navVisible  = false;
  let navIndex    = 0; // index within unlockedCities[]
  let hideTimer   = null;

  function unlockedCities() {
    return (typeof ALL_CITIES_LIST !== 'undefined' ? ALL_CITIES_LIST : [])
      .filter(c => typeof isCityUnlocked === 'function' ? isCityUnlocked(c.id) : true);
  }

  function currentCityIndex() {
    const cities = unlockedCities();
    const idx = cities.findIndex(c => c.id === (typeof cityId !== 'undefined' ? cityId : ''));
    return idx >= 0 ? idx : 0;
  }

  function renderNav() {
    const cities = unlockedCities();
    const navEl  = document.getElementById('tvNavCities');
    if (!navEl) return;

    // Clamp navIndex
    navIndex = Math.max(0, Math.min(navIndex, cities.length - 1));

    navEl.innerHTML = cities.map((c, i) => {
      const isSel = i === navIndex;
      const isCur = c.id === (typeof cityId !== 'undefined' ? cityId : '');
      let cls = 'tv-city-btn';
      if (isSel) cls += ' active';
      else if (isCur) cls += ' current';
      return `<div class="${cls}" data-id="${c.id}">${c.label}</div>`;
    }).join('');
  }

  function showNav() {
    if (!navVisible) {
      navVisible = true;
      navIndex = currentCityIndex();
      document.getElementById('tvNav').classList.add('visible');
      renderNav();
    }
    // Reset hide timer on every interaction
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideNav, 5000);
  }

  function hideNav() {
    navVisible = false;
    document.getElementById('tvNav').classList.remove('visible');
    clearTimeout(hideTimer);
  }

  // ── Remote key handler ────────────────────────────────────────────────────
  Platform.onRemoteKey(({ action }) => {
    switch (action) {
      case 'LEFT':
        showNav();
        navIndex = Math.max(0, navIndex - 1);
        renderNav();
        break;

      case 'RIGHT':
        showNav();
        navIndex = Math.min(unlockedCities().length - 1, navIndex + 1);
        renderNav();
        break;

      case 'ENTER': {
        if (!navVisible) { showNav(); break; }
        const chosen = unlockedCities()[navIndex];
        if (chosen && typeof pickCity === 'function') {
          pickCity(chosen.id);
        }
        hideNav();
        break;
      }

      case 'BACK':
        if (navVisible) { hideNav(); }
        else { Platform.exit(); }
        break;

      default:
        break;
    }
  });

  // ── Click/tap on nav items (for emulator testing with mouse) ──────────────
  document.getElementById('tvNavCities').addEventListener('click', e => {
    const btn = e.target.closest('.tv-city-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    if (id && typeof pickCity === 'function') {
      pickCity(id);
      hideNav();
    }
  });
}
