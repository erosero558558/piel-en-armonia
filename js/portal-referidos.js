(function (window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;

    function readSession() {
        return portalShell && typeof portalShell.getSession === 'function'
            ? portalShell.getSession()
            : null;
    }

    function isFreshSession(session) {
        return Boolean(
            portalShell &&
                typeof portalShell.isFreshSession === 'function' &&
                portalShell.isFreshSession(session)
        );
    }

    function redirectToLogin() {
        if (portalShell && typeof portalShell.redirectToLogin === 'function') {
            portalShell.redirectToLogin();
            return;
        }

        window.location.replace('/es/portal/login/');
    }

    async function fetchReferralStats(patientId) {
        try {
            const response = await window.fetch(`/api.php?resource=referral-stats&patient_id=${encodeURIComponent(patientId)}`, {
                headers: {
                    Accept: 'application/json'
                },
            });

            const body = await response.json().catch(() => ({}));
            return {
                ok: response.ok,
                body,
            };
        } catch (e) {
            return { ok: false, body: null };
        }
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }

    async function loadStats() {
        const session = readSession();
        if (!isFreshSession(session)) {
            if (portalShell && typeof portalShell.clearSession === 'function') {
                portalShell.clearSession();
            }
            redirectToLogin();
            return;
        }

        const patientId = session.patient?.id || '';
        if (!patientId) {
            console.error('[portal-referidos] No patient id found');
            return;
        }

        const result = await fetchReferralStats(patientId);
        
        const linkInput = document.getElementById('referralLink');
        const clicksEl = document.getElementById('clicksCount');
        const conversionsEl = document.getElementById('conversionsCount');
        const benefitsContainer = document.getElementById('benefitsContainer');
        const copyBtn = document.getElementById('copyBtn');
        const copyStatus = document.getElementById('copyStatus');

        if (result.ok && result.body?.data) {
            const data = result.body.data;
            const stats = data.stats || {};
            
            if (linkInput) linkInput.value = data.share_url || 'https://pielarmonia.com/es/referidos/?ref=' + (stats.code || '');
            if (clicksEl) clicksEl.textContent = stats.clicks || '0';
            if (conversionsEl) conversionsEl.textContent = stats.conversions || '0';

            const benefits = stats.earned_benefits || [];
            if (benefits.length > 0 && benefitsContainer) {
                let html = '';
                benefits.forEach(b => {
                    html += `
                        <div class="benefit-item">
                            <span class="description">${escapeHtml(b.description)}</span>
                            <span class="status">DISPONIBLE</span>
                        </div>
                    `;
                });
                benefitsContainer.innerHTML = html;
            }

            if (copyBtn && linkInput) {
                copyBtn.addEventListener('click', () => {
                    linkInput.select();
                    linkInput.setSelectionRange(0, 99999); // Mobile
                    try {
                        navigator.clipboard.writeText(linkInput.value).then(() => {
                            if (copyStatus) {
                                copyStatus.style.display = 'block';
                                setTimeout(() => {
                                    copyStatus.style.display = 'none';
                                }, 3000);
                            }
                        });
                    } catch(err) {
                        try {
                            document.execCommand('copy');
                            if (copyStatus) {
                                copyStatus.style.display = 'block';
                                setTimeout(() => {
                                    copyStatus.style.display = 'none';
                                }, 3000);
                            }
                        } catch(e) {
                            console.error('Error copying text', e);
                        }
                    }
                });
            }
        } else {
            if (linkInput) linkInput.value = 'No se pudo cargar el enlace.';
        }
    }

    document.addEventListener('DOMContentLoaded', loadStats);
})(window, document);
