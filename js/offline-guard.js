(() => {
  const localOrigin = window.location.origin;
  const isExternal = (value) => {
    try {
      return new URL(value, window.location.href).origin !== localOrigin;
    } catch {
      return false;
    }
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url && isExternal(url)) return Promise.reject(new Error('Offline mode blocks external requests'));
    return nativeFetch(input, init);
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (link && isExternal(link.href)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
})();
