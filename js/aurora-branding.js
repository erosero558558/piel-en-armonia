/**
 * Aurora Derm — Whitelabel Hydration Script
 * Fetches the clinic branding config and injects name, logos, and city across the DOM.
 */
document.addEventListener('DOMContentLoaded', () => {
  const hydrateBranding = async () => {
    try {
      // 1. Fetch metadata
      const res = await fetch('/api.php?resource=clinic-branding-meta');
      if (!res.ok) return;
      const payload = await res.json();
      if (!payload.ok || !payload.data) return;

      const { name, short_name, city, logo_url } = payload.data;

      // 2. Hydrate Name
      if (name) {
        document.title = document.title.replace(/Aurora( Derm)?/, name);
        document.querySelectorAll('.aurora-brand-name').forEach(el => {
          el.textContent = name;
        });

        // Hydrate PWA names for homescreen
        document.querySelectorAll('meta[name="application-name"]').forEach(el => el.setAttribute('content', name));
        document.querySelectorAll('meta[name="apple-mobile-web-app-title"]').forEach(el => el.setAttribute('content', name));
        
        // Dynamically point manifest to Whitelabel endpoint
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
          manifestLink.setAttribute('href', '/api.php?resource=clinic-manifest');
        }
      }

      // 3. Hydrate Short Name
      if (short_name) {
        document.querySelectorAll('.aurora-brand-short').forEach(el => {
          el.textContent = short_name;
        });
      }

      // 4. Hydrate Logo
      if (logo_url) {
        document.querySelectorAll('.aurora-brand-logo').forEach(el => {
          if (el.tagName === 'IMG') {
            el.src = logo_url;
            el.style.display = 'block';
          } else {
            el.style.backgroundImage = `url(${logo_url})`;
          }
        });
        
        // Update favicon if logo provided
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = logo_url;
      }
      
      // Emit event for SPA components to react
      document.dispatchEvent(new CustomEvent('aurora:branding:hydrated', { detail: payload.data }));

    } catch (err) {
      console.warn('AuroraBranding: Failed to hydrate branding', err);
    }
  };

  hydrateBranding();
});
