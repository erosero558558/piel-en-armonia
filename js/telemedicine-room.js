(function(window, document) {
    'use strict';

    const portalShell = window.AuroraPatientPortalShell || null;

    function readSession() {
        return portalShell && typeof portalShell.getSession === 'function' ? portalShell.getSession() : null;
    }

    async function initRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const appointmentId = urlParams.get('id');
        const tokenParam = urlParams.get('token');

        if (!appointmentId && !tokenParam) {
            handleError('Cita no especificada. Por favor retorna a tu portal o al admin.');
            return;
        }

        const session = readSession();
        const token = session ? session.token : null;
        const resourceParams = new URLSearchParams();
        if (tokenParam) {
            resourceParams.set('token', tokenParam);
        } else if (appointmentId) {
            resourceParams.set('id', appointmentId);
        }

        try {
            const response = await fetch(`/api.php?resource=telemedicine-room-token&${resourceParams.toString()}`, {
                headers: {
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            const body = await response.json().catch(() => ({}));

            if (!body.ok) {
                handleError('No pudimos conectarte a la sala: ' + (body.error || 'Autenticación fallida'));
                return;
            }

            document.getElementById('telemedicine-loader').style.display = 'none';

            const data = body.data;
            mountJitsi(data.roomName, data.displayName, data.role);
        } catch (e) {
            handleError('Error de red cargando la sala. Por favor verifica tu conexión.');
            console.error('[Telemedicine]', e);
        }
    }

    function handleError(msg) {
        const loader = document.getElementById('telemedicine-loader');
        if (loader) {
            loader.innerHTML = `<p style="color:var(--text-danger); text-align:center;">${msg}</p>`;
        } else {
            alert(msg);
        }
    }

    function mountJitsi(roomName, displayName, role) {
        if (!window.JitsiMeetExternalAPI) {
            handleError('El motor de video no pudo cargar. Comprueba tu conexión a internet e intenta de nuevo.');
            return;
        }

        const domain = 'meet.jit.si';
        const options = {
            roomName: roomName,
            width: '100%',
            height: '100%',
            parentNode: document.getElementById('jitsi-container'),
            userInfo: {
                displayName: displayName
            },
            configOverwrite: {
                startWithAudioMuted: false,
                startWithVideoMuted: false,
                disableDeepLinking: true,
                prejoinPageEnabled: true,
                disableSimulcast: false
            },
            interfaceConfigOverwrite: {
                TOOLBAR_BUTTONS: [
                    'microphone', 'camera', 'desktop', 'fullscreen',
                    'fodeviceselection', 'hangup', 'chat',
                    'settings', 'raisehand', 'videoquality', 'tileview'
                ],
                SHOW_CHROME_EXTENSION_BANNER: false,
                SHOW_JITSI_WATERMARK: false,
                SHOW_BRAND_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false
            }
        };

        const api = new window.JitsiMeetExternalAPI(domain, options);
        
        api.addEventListener('videoConferenceLeft', () => {
            if (role === 'participant') {
                window.location.href = '/es/portal/';
            } else {
                window.location.href = '/admin.html';
            }
        });

        window.telemedicineApi = api;
        window.telemedicineRole = role;
        window.dispatchEvent(new CustomEvent('telemedicine:ready', { detail: { api, role } }));
    }

    document.addEventListener('DOMContentLoaded', initRoom);
})(window, document);
