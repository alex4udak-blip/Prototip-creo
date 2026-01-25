window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js', { scope: './' })
      .then(function (reg) {
        window.serviceWorkerRegistration = reg;
        window.dispatchEvent(new Event('serviceWorkerRegistration'));
      });
  }
});
