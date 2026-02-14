/* ============================================
   Aid Connect - Accessibility Widget
   תקן 5568 / WCAG 2.1 AA
   ============================================ */

(function() {
  'use strict';

  const STORAGE_KEY = 'aidconnect-a11y';

  // Default settings
  const defaults = {
    fontSize: 0,        // -3 to +5 steps
    highContrast: false,
    grayscale: false,
    linkHighlight: false,
    keyboardNav: false,
    stopAnimations: false
  };

  let settings = loadSettings();

  // ==========================================
  // Settings persistence
  // ==========================================
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? Object.assign({}, defaults, JSON.parse(saved)) : Object.assign({}, defaults);
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // localStorage not available
    }
  }

  // ==========================================
  // Apply settings to DOM
  // ==========================================
  function applyAll() {
    applyFontSize();
    applyHighContrast();
    applyGrayscale();
    applyLinkHighlight();
    applyKeyboardNav();
    applyStopAnimations();
    updateButtonStates();
    saveSettings();
  }

  function applyFontSize() {
    const root = document.documentElement;
    const base = 16 + (settings.fontSize * 2); // Each step = 2px
    root.style.fontSize = base + 'px';
    const display = document.getElementById('a11y-font-size-value');
    if (display) {
      display.textContent = settings.fontSize > 0 ? '+' + settings.fontSize : String(settings.fontSize);
    }
  }

  function applyHighContrast() {
    document.body.classList.toggle('a11y-high-contrast', settings.highContrast);
  }

  function applyGrayscale() {
    document.body.classList.toggle('a11y-grayscale', settings.grayscale);
  }

  function applyLinkHighlight() {
    document.body.classList.toggle('a11y-link-highlight', settings.linkHighlight);
  }

  function applyKeyboardNav() {
    document.body.classList.toggle('a11y-keyboard-nav', settings.keyboardNav);
  }

  function applyStopAnimations() {
    document.body.classList.toggle('a11y-stop-animations', settings.stopAnimations);
  }

  function updateButtonStates() {
    const toggles = {
      'a11y-btn-contrast': settings.highContrast,
      'a11y-btn-grayscale': settings.grayscale,
      'a11y-btn-links': settings.linkHighlight,
      'a11y-btn-keyboard': settings.keyboardNav,
      'a11y-btn-animations': settings.stopAnimations
    };

    Object.keys(toggles).forEach(function(id) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', toggles[id]);
        btn.setAttribute('aria-pressed', String(toggles[id]));
      }
    });
  }

  // ==========================================
  // Reset all settings
  // ==========================================
  function resetAll() {
    settings = Object.assign({}, defaults);
    applyAll();
    announceToScreenReader('כל הגדרות הנגישות אופסו');
  }

  // ==========================================
  // Screen reader announcements
  // ==========================================
  function announceToScreenReader(message) {
    var announcer = document.getElementById('a11y-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'a11y-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      document.body.appendChild(announcer);
    }
    announcer.textContent = '';
    setTimeout(function() {
      announcer.textContent = message;
    }, 100);
  }

  // ==========================================
  // Build the widget DOM
  // ==========================================
  function createWidget() {
    // Toggle button
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'a11y-toggle';
    toggleBtn.className = 'a11y-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'פתח תפריט נגישות');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-controls', 'a11y-panel');
    toggleBtn.innerHTML = '<span class="a11y-icon" aria-hidden="true">♿</span>';
    toggleBtn.title = 'נגישות';

    // Panel
    var panel = document.createElement('div');
    panel.id = 'a11y-panel';
    panel.className = 'a11y-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'הגדרות נגישות');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('hidden', '');

    panel.innerHTML =
      '<div class="a11y-panel-header">' +
        '<h2 id="a11y-panel-title">הגדרות נגישות</h2>' +
        '<button id="a11y-close" class="a11y-close-btn" aria-label="סגור תפריט נגישות">&times;</button>' +
      '</div>' +
      '<div class="a11y-panel-body">' +
        // Font size
        '<div class="a11y-control-group">' +
          '<span class="a11y-control-label" id="a11y-fontsize-label">גודל גופן</span>' +
          '<div class="a11y-font-controls" role="group" aria-labelledby="a11y-fontsize-label">' +
            '<button id="a11y-btn-font-decrease" class="a11y-btn a11y-btn-sm" aria-label="הקטן גופן">א-</button>' +
            '<span id="a11y-font-size-value" class="a11y-font-value" aria-live="polite">0</span>' +
            '<button id="a11y-btn-font-increase" class="a11y-btn a11y-btn-sm" aria-label="הגדל גופן">א+</button>' +
          '</div>' +
        '</div>' +
        // High contrast
        '<button id="a11y-btn-contrast" class="a11y-btn a11y-btn-toggle" role="switch" aria-pressed="false">' +
          '<span class="a11y-btn-icon" aria-hidden="true">◑</span>' +
          '<span>ניגודיות גבוהה</span>' +
        '</button>' +
        // Grayscale
        '<button id="a11y-btn-grayscale" class="a11y-btn a11y-btn-toggle" role="switch" aria-pressed="false">' +
          '<span class="a11y-btn-icon" aria-hidden="true">◐</span>' +
          '<span>גווני אפור</span>' +
        '</button>' +
        // Link highlight
        '<button id="a11y-btn-links" class="a11y-btn a11y-btn-toggle" role="switch" aria-pressed="false">' +
          '<span class="a11y-btn-icon" aria-hidden="true">🔗</span>' +
          '<span>הדגשת קישורים</span>' +
        '</button>' +
        // Keyboard nav
        '<button id="a11y-btn-keyboard" class="a11y-btn a11y-btn-toggle" role="switch" aria-pressed="false">' +
          '<span class="a11y-btn-icon" aria-hidden="true">⌨</span>' +
          '<span>ניווט מקלדת</span>' +
        '</button>' +
        // Stop animations
        '<button id="a11y-btn-animations" class="a11y-btn a11y-btn-toggle" role="switch" aria-pressed="false">' +
          '<span class="a11y-btn-icon" aria-hidden="true">⏸</span>' +
          '<span>עצירת אנימציות</span>' +
        '</button>' +
        // Reset
        '<button id="a11y-btn-reset" class="a11y-btn a11y-btn-reset" aria-label="איפוס כל הגדרות הנגישות">' +
          '<span class="a11y-btn-icon" aria-hidden="true">↺</span>' +
          '<span>איפוס</span>' +
        '</button>' +
        // Accessibility statement link
        '<a href="accessibility-statement.html" class="a11y-statement-link" aria-label="הצהרת נגישות">' +
          'הצהרת נגישות' +
        '</a>' +
      '</div>';

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    // ==========================================
    // Event Listeners
    // ==========================================

    // Toggle panel open/close
    toggleBtn.addEventListener('click', function() {
      var isOpen = !panel.hasAttribute('hidden');
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });

    // Close button
    document.getElementById('a11y-close').addEventListener('click', closePanel);

    // Font size controls
    document.getElementById('a11y-btn-font-increase').addEventListener('click', function() {
      if (settings.fontSize < 5) {
        settings.fontSize++;
        applyAll();
        announceToScreenReader('גודל גופן: ' + (settings.fontSize > 0 ? '+' : '') + settings.fontSize);
      }
    });

    document.getElementById('a11y-btn-font-decrease').addEventListener('click', function() {
      if (settings.fontSize > -3) {
        settings.fontSize--;
        applyAll();
        announceToScreenReader('גודל גופן: ' + (settings.fontSize > 0 ? '+' : '') + settings.fontSize);
      }
    });

    // Toggle buttons
    document.getElementById('a11y-btn-contrast').addEventListener('click', function() {
      settings.highContrast = !settings.highContrast;
      applyAll();
      announceToScreenReader('ניגודיות גבוהה ' + (settings.highContrast ? 'מופעלת' : 'כבויה'));
    });

    document.getElementById('a11y-btn-grayscale').addEventListener('click', function() {
      settings.grayscale = !settings.grayscale;
      applyAll();
      announceToScreenReader('גווני אפור ' + (settings.grayscale ? 'מופעל' : 'כבוי'));
    });

    document.getElementById('a11y-btn-links').addEventListener('click', function() {
      settings.linkHighlight = !settings.linkHighlight;
      applyAll();
      announceToScreenReader('הדגשת קישורים ' + (settings.linkHighlight ? 'מופעלת' : 'כבויה'));
    });

    document.getElementById('a11y-btn-keyboard').addEventListener('click', function() {
      settings.keyboardNav = !settings.keyboardNav;
      applyAll();
      announceToScreenReader('ניווט מקלדת ' + (settings.keyboardNav ? 'מופעל' : 'כבוי'));
    });

    document.getElementById('a11y-btn-animations').addEventListener('click', function() {
      settings.stopAnimations = !settings.stopAnimations;
      applyAll();
      announceToScreenReader('אנימציות ' + (settings.stopAnimations ? 'מושבתות' : 'מופעלות'));
    });

    // Reset
    document.getElementById('a11y-btn-reset').addEventListener('click', resetAll);

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !panel.hasAttribute('hidden')) {
        closePanel();
      }
    });

    // Close when clicking outside panel
    document.addEventListener('click', function(e) {
      if (!panel.hasAttribute('hidden') && !panel.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
        closePanel();
      }
    });

    function openPanel() {
      panel.removeAttribute('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
      panel.classList.add('a11y-panel-open');
      // Focus trap - focus the first interactive element
      var firstFocusable = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) firstFocusable.focus();
      // Set up focus trap
      trapFocus(panel);
    }

    function closePanel() {
      panel.setAttribute('hidden', '');
      panel.classList.remove('a11y-panel-open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.focus();
      releaseFocusTrap();
    }
  }

  // ==========================================
  // Focus trap for panel
  // ==========================================
  var focusTrapHandler = null;

  function trapFocus(element) {
    var focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    var firstFocusable = focusableElements[0];
    var lastFocusable = focusableElements[focusableElements.length - 1];

    focusTrapHandler = function(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    };

    element.addEventListener('keydown', focusTrapHandler);
  }

  function releaseFocusTrap() {
    var panel = document.getElementById('a11y-panel');
    if (panel && focusTrapHandler) {
      panel.removeEventListener('keydown', focusTrapHandler);
      focusTrapHandler = null;
    }
  }

  // ==========================================
  // Global keyboard navigation enhancements
  // ==========================================
  document.addEventListener('keydown', function(e) {
    // Skip to main content with Alt+1
    if (e.altKey && e.key === '1') {
      var main = document.querySelector('main, [role="main"], #main-content');
      if (main) {
        main.setAttribute('tabindex', '-1');
        main.focus();
        e.preventDefault();
      }
    }

    // Open accessibility menu with Alt+A
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      var toggleBtn = document.getElementById('a11y-toggle');
      if (toggleBtn) {
        toggleBtn.click();
        e.preventDefault();
      }
    }
  });

  // ==========================================
  // Detect keyboard vs mouse usage
  // ==========================================
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      document.body.classList.add('a11y-using-keyboard');
    }
  });

  document.addEventListener('mousedown', function() {
    document.body.classList.remove('a11y-using-keyboard');
  });

  // ==========================================
  // Initialize on DOM ready
  // ==========================================
  function init() {
    createWidget();
    applyAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
