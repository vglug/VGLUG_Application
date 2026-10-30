// Applies the saved theme before first paint to avoid a flash of the wrong theme.
(function () {
  try {
    var saved = localStorage.getItem('vglug-theme');
    var theme = saved === 'light' || saved === 'dark' ? saved
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
