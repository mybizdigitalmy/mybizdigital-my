/* PR-002 — independent, testable auth policy. No SDK, storage or network access here. */
(function (scope, factory) {
  'use strict';
  const api = Object.freeze(factory());
  if (scope) scope.MBDAuthPolicy = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const projectId = 'mybizdigital-staging';
  const authDomain = projectId + '.firebaseapp.com';
  function stagingHost(host) {
    return host === 'localhost' || host === '127.0.0.1' ||
      host === projectId + '.web.app' ||
      host === projectId + '.firebaseapp.com' ||
      /^mybizdigital-staging--[a-z0-9-]+\.web\.app$/.test(host);
  }
  function configValid(config) {
    return !!config && typeof config === 'object' &&
      config.projectId === projectId && config.authDomain === authDomain &&
      typeof config.apiKey === 'string' &&
      /^AIza[\w-]{20,}$/.test(config.apiKey) &&
      typeof config.appId === 'string' && /^1:[0-9]+:web:[a-zA-Z0-9]+$/.test(config.appId);
  }
  function normalizeEmail(raw) {
    const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }
  // Same special-character set documented for Firebase password policies.
  const firebasePasswordSpecials = new Set(["^","$","*",".","[","]","{","}","(",")","?","\"","!","@","#","%","&","/","\\",",",">","<","'",":",";","|","_","~"]);
  function strongPassword(value) {
    return typeof value === 'string' && value.length >= 12 && value.length <= 128 &&
      /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) &&
      Array.from(value).some(character => firebasePasswordSpecials.has(character));
  }
  function verifiedCustomer(user) {
    return !!user && user.emailVerified === true && user.isAnonymous !== true &&
      typeof user.uid === 'string' && user.uid.length > 0;
  }
  function rateAllowed(lastSentAt, now) {
    return !Number.isFinite(lastSentAt) || now - lastSentAt >= 60000;
  }
  function safeError(code) {
    switch (code) {
      case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
      case 'auth/network-request-failed': return 'Network problem. Check your connection and try again.';
      case 'auth/weak-password':
      case 'auth/password-does-not-meet-requirements':
        return 'Choose a stronger password that meets the displayed requirements.';
      case 'auth/invalid-email': return 'Enter a valid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled for this staging project.';
      default: return 'Unable to complete this request. Check the details and try again.';
    }
  }
  return { stagingHost, configValid, normalizeEmail, strongPassword, verifiedCustomer, rateAllowed, safeError };
});
