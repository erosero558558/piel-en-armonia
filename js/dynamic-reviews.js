// dynamic-reviews.js
document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('.dynamic-reviews[data-service]');
    if (containers.length === 0) return;

    containers.forEach(async (container) => {
        const service = container.getAttribute('data-service');
        try {
            const resp = await fetch(`/api.php?resource=reviews&service=${encodeURIComponent(service)}`);
            const json = await resp.json();
            
            if (json.ok && json.data) {
                renderReviews(container, json.data);
            }
        } catch (err) {
            console.error('Failed to load dynamic reviews', err);
        }
    });

    function renderReviews(container, data) {
        const { rating, count, latest } = data;
        
        if (count === 0 || !latest || latest.length === 0) {
            return; // Fallback happens in backend, but just in case
        }
        
        let latestHtml = latest.map(rev => {
            const initial = rev.name ? rev.name.charAt(0).toUpperCase() : 'P';
            const stars = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);
            
            // Format text nicely if it's empty
            const textHTML = rev.text ? `<p style="font-size: 0.95rem; margin-top: 0.5rem; line-height: 1.5;">${rev.text}</p>` : '';
            
            return `
            <div class="card" style="padding: 1.5rem; border: 1px solid var(--border-light, #eee); border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                 <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--pub-primary, #1e3a8a); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                    ${initial}
                 </div>
                 <div>
                   <strong style="display: block;">${rev.name}</strong>
                   <span style="font-size: 0.8rem; color: var(--text-muted, #666);">${new Date(rev.date).toLocaleDateString()}</span>
                 </div>
              </div>
              <div style="color: #FACC15; letter-spacing: 2px;">${stars}</div>
              ${textHTML}
            </div>`;
        }).join('');

        const ratingInt = Math.round(rating);
        const headerStars = '★'.repeat(ratingInt) + '☆'.repeat(5 - ratingInt);

        container.innerHTML = `
          <div style="text-align: center; margin-bottom: 2rem;">
            <h2 style="font-size: 1.8rem; margin-bottom: 0.5rem;">Lo que dicen nuestros pacientes</h2>
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
              <span style="font-size: 1.5rem; font-weight: bold;">${rating.toFixed(1)}</span>
              <span style="color: #FACC15; font-size: 1.25rem;">${headerStars}</span>
              <span style="color: var(--text-muted, #666);">(${count} reseñas globales)</span>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
            ${latestHtml}
          </div>
        `;
    }
});
