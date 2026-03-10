(function () {
    const titleEl = document.getElementById('bootTitle');
    const messageEl = document.getElementById('bootMessage');
    const surfaceEl = document.getElementById('bootSurface');
    const baseUrlEl = document.getElementById('bootBaseUrl');
    const phaseEl = document.getElementById('bootPhase');
    const retryBtn = document.getElementById('bootRetryBtn');

    function render(snapshot) {
        if (!snapshot) {
            return;
        }
        if (titleEl) {
            titleEl.textContent =
                snapshot.phase === 'ready'
                    ? 'Shell conectado'
                    : 'Inicializando shell operativo';
        }
        if (messageEl) {
            messageEl.textContent =
                snapshot.message || 'Cargando la superficie y comprobando conectividad.';
        }
        if (surfaceEl) {
            surfaceEl.textContent = snapshot.config?.surface || '-';
        }
        if (baseUrlEl) {
            baseUrlEl.textContent = snapshot.config?.baseUrl || '-';
        }
        if (phaseEl) {
            phaseEl.textContent = snapshot.phase || 'boot';
        }
    }

    if (window.turneroDesktop) {
        window.turneroDesktop
            .getRuntimeSnapshot()
            .then((snapshot) => {
                render({
                    ...snapshot.status,
                    config: snapshot.config,
                });
            })
            .catch(() => {});

        window.turneroDesktop.onBootStatus((payload) => {
            window.turneroDesktop
                .getRuntimeSnapshot()
                .then((snapshot) => {
                    render({
                        ...payload,
                        config: snapshot.config,
                    });
                })
                .catch(() => {
                    render(payload);
                });
        });
    }

    if (retryBtn && window.turneroDesktop) {
        retryBtn.addEventListener('click', () => {
            retryBtn.disabled = true;
            window.turneroDesktop
                .retryLoad()
                .finally(() => {
                    retryBtn.disabled = false;
                });
        });
    }
})();
