/*
 * Preprost, lahek cookie consent banner (brez zunanjih knjižnic).
 * Ne blokira nalaganja Google Analytics (gtag.js) - gtag.js se
 * nalaga ločeno v <head> vsake strani, ta skripta samo prikaže
 * uporabniku obvestilo in shrani njegovo izbiro v localStorage.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cookieConsent';

  function getStoredConsent() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function storeConsent(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      /* localStorage ni na voljo - banner se bo prikazal znova */
    }
  }

  function injectStyles() {
    if (document.getElementById('cookie-consent-styles')) {
      return;
    }

    var style = document.createElement('style');
    style.id = 'cookie-consent-styles';
    style.textContent =
      '.cookie-consent-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;' +
      'padding:16px 20px;background:#0f1f2e;color:#f4f7fa;' +
      'box-shadow:0 -2px 12px rgba(0,0,0,0.2);font-family:Inter,ui-sans-serif,system-ui,sans-serif;}' +
      '.cookie-consent-banner p{margin:0;flex:1 1 260px;font-size:14px;line-height:1.5;}' +
      '.cookie-consent-actions{display:flex;gap:10px;flex:0 0 auto;}' +
      '.cookie-consent-actions button{cursor:pointer;border-radius:6px;padding:10px 18px;' +
      'font-size:14px;font-weight:600;border:1px solid transparent;}' +
      '.cookie-consent-accept{background:#01457e;color:#fff;}' +
      '.cookie-consent-reject{background:transparent;color:#f4f7fa;border-color:#f4f7fa;}' +
      '@media (max-width:520px){.cookie-consent-banner{flex-direction:column;align-items:stretch;}' +
      '.cookie-consent-actions{justify-content:stretch;}' +
      '.cookie-consent-actions button{flex:1 1 auto;}}';
    document.head.appendChild(style);
  }

  function removeBanner(banner) {
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }

  function showBanner() {
    injectStyles();

    var banner = document.createElement('div');
    banner.className = 'cookie-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Obvestilo o piškotkih');

    var text = document.createElement('p');
    text.textContent =
      'Ta stran uporablja piškotke za analitiko obiska (Google Analytics). ' +
      'S klikom na "Prihvati" se strinjate z uporabo piškotkov, s klikom na "Odbij" pa piškotki ne bodo naloženi.';

    var actions = document.createElement('div');
    actions.className = 'cookie-consent-actions';

    var acceptButton = document.createElement('button');
    acceptButton.type = 'button';
    acceptButton.className = 'cookie-consent-accept';
    acceptButton.textContent = 'Prihvati';
    acceptButton.addEventListener('click', function () {
      storeConsent('accepted');
      removeBanner(banner);
    });

    var rejectButton = document.createElement('button');
    rejectButton.type = 'button';
    rejectButton.className = 'cookie-consent-reject';
    rejectButton.textContent = 'Odbij';
    rejectButton.addEventListener('click', function () {
      storeConsent('rejected');
      removeBanner(banner);
    });

    actions.appendChild(acceptButton);
    actions.appendChild(rejectButton);

    banner.appendChild(text);
    banner.appendChild(actions);

    document.body.appendChild(banner);
  }

  function init() {
    if (getStoredConsent()) {
      return;
    }
    showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
