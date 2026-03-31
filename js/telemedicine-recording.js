(function(window, document) {
    'use strict';

    let api = null;
    let role = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let patientParticipantId = null;
    let pendingRequestId = null;

    const recordBtn = document.getElementById('record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const consentModal = document.getElementById('recording-consent-modal');
    const denyBtn = document.getElementById('deny-recording-btn');
    const acceptBtn = document.getElementById('accept-recording-btn');

    window.addEventListener('telemedicine:ready', (event) => {
        api = event.detail.api;
        role = event.detail.role;

        if (role === 'moderator') {
            recordBtn.style.display = 'inline-flex';
            setupModeratorListeners();
        } else {
            setupParticipantListeners();
        }
    });

    function getAppointmentId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || null;
    }

    function getTokenParam() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token') || null;
    }

    function getPortalBearer() {
        const portalShell = window.AuroraPatientPortalShell || null;
        const session = portalShell && typeof portalShell.getSession === 'function'
            ? portalShell.getSession()
            : null;
        return session ? session.token : null;
    }

    function buildResourceUrl(resource) {
        const appointmentId = getAppointmentId();
        const token = getTokenParam();
        const params = new URLSearchParams();
        if (appointmentId) {
            params.set('id', appointmentId);
        } else if (token) {
            params.set('token', token);
        }

        return `/api.php?resource=${resource}${params.toString() ? `&${params.toString()}` : ''}`;
    }

    async function persistRecordingConsent(action, requestId) {
        const body = new URLSearchParams();
        body.set('action', action);
        if (requestId) {
            body.set('requestId', requestId);
        }

        const res = await fetch(buildResourceUrl('telemedicine-recording-consent'), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                ...(getPortalBearer() ? { Authorization: `Bearer ${getPortalBearer()}` } : {})
            },
            body: body.toString()
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload.ok) {
            throw new Error(payload.error || 'No se pudo registrar el consentimiento.');
        }

        return payload.data && payload.data.consent ? payload.data.consent : {};
    }

    function setupModeratorListeners() {
        recordBtn.addEventListener('click', async () => {
            const participants = api.getParticipantsInfo();
            const patient = participants.find((participant) => participant.role !== 'moderator');

            if (!patient) {
                alert('Aún no hay ningún paciente en la sala para solicitar el consenso.');
                return;
            }

            const confirmed = window.confirm(
                'Confirmo que necesito grabar esta teleconsulta con fines clínicos y que la grabación solo se archivará si ambas partes aceptan expresamente.'
            );
            if (!confirmed) {
                return;
            }

            patientParticipantId = patient.participantId;
            recordBtn.disabled = true;
            recordBtn.textContent = 'Solicitando permiso...';

            try {
                const consent = await persistRecordingConsent('request');
                pendingRequestId = consent.requestId || null;

                api.executeCommand('sendEndpointTextMessage', patientParticipantId, JSON.stringify({
                    type: 'RECORDING_REQUEST',
                    requestId: pendingRequestId
                }));
            } catch (error) {
                console.error('Error requesting recording consent:', error);
                alert(error.message || 'No se pudo registrar la solicitud de consentimiento.');
                recordBtn.disabled = false;
                recordBtn.textContent = 'Grabar Consulta';
            }
        });

        stopRecordBtn.addEventListener('click', stopRecording);

        api.addEventListener('endpointTextMessageReceived', (event) => {
            try {
                const message = JSON.parse(event.data.text);
                if (message.type === 'RECORDING_CONSENT_GRANTED') {
                    if (pendingRequestId && message.requestId && pendingRequestId !== message.requestId) {
                        return;
                    }
                    startRecordingWrapper();
                } else if (message.type === 'RECORDING_CONSENT_DENIED') {
                    alert('El paciente ha denegado el permiso para grabar la consulta.');
                    pendingRequestId = null;
                    recordBtn.disabled = false;
                    recordBtn.textContent = 'Grabar Consulta';
                }
            } catch (error) {
                console.error('Error parsing endpoint message', error);
            }
        });
    }

    function setupParticipantListeners() {
        api.addEventListener('endpointTextMessageReceived', (event) => {
            try {
                const message = JSON.parse(event.data.text);
                if (message.type === 'RECORDING_REQUEST') {
                    pendingRequestId = message.requestId || null;
                    const moderatorId = event.data.senderInfo.id;
                    showConsentModal(moderatorId, pendingRequestId);
                }
            } catch (error) {
                console.error('Error parsing endpoint message', error);
            }
        });

        api.addEventListener('videoConferenceLeft', () => {
            if (isRecording) stopRecording();
        });
    }

    function showConsentModal(moderatorId, requestId) {
        consentModal.classList.remove('hidden');

        denyBtn.onclick = async () => {
            denyBtn.disabled = true;
            acceptBtn.disabled = true;
            try {
                await persistRecordingConsent('deny', requestId);
                consentModal.classList.add('hidden');
                api.executeCommand('sendEndpointTextMessage', moderatorId, JSON.stringify({
                    type: 'RECORDING_CONSENT_DENIED',
                    requestId: requestId || null
                }));
            } catch (error) {
                console.error('Error denying recording consent', error);
                alert(error.message || 'No se pudo guardar la decision de rechazo.');
            } finally {
                denyBtn.disabled = false;
                acceptBtn.disabled = false;
            }
        };

        acceptBtn.onclick = async () => {
            denyBtn.disabled = true;
            acceptBtn.disabled = true;
            try {
                await persistRecordingConsent('grant', requestId);
                consentModal.classList.add('hidden');
                api.executeCommand('sendEndpointTextMessage', moderatorId, JSON.stringify({
                    type: 'RECORDING_CONSENT_GRANTED',
                    requestId: requestId || null
                }));
            } catch (error) {
                console.error('Error granting recording consent', error);
                alert(error.message || 'No se pudo guardar la decision de consentimiento.');
            } finally {
                denyBtn.disabled = false;
                acceptBtn.disabled = false;
            }
        };
    }

    async function startRecordingWrapper() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'browser', width: { ideal: 1280 }, frameRate: { ideal: 15 } },
                audio: true
            });

            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStream.getAudioTracks().forEach((track) => {
                    stream.addTrack(track);
                });
            } catch (micErr) {
                console.warn('Microphone permission denied or unavailable for recording multiplexing', micErr);
            }

            startMediaRecorder(stream);

            stream.getVideoTracks()[0].onended = function () {
                stopRecording();
            };

            recordBtn.style.display = 'none';
            stopRecordBtn.style.display = 'inline-flex';
            recordingIndicator.style.display = 'flex';
            isRecording = true;
        } catch (err) {
            console.error('Error starting screen capture: ', err);
            alert('No se pudo compartir la pantalla para la grabación. Detalle: ' + err.message);
            recordBtn.disabled = false;
            recordBtn.textContent = 'Grabar Consulta';
        }
    }

    function startMediaRecorder(stream) {
        recordedChunks = [];
        let options = { mimeType: 'video/webm; codecs=vp9,opus' };

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm; codecs=vp8,opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm' };
            }
        }

        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = function (event) {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = function () {
            const blob = new Blob(recordedChunks, { type: options.mimeType });
            uploadRecording(blob);

            stream.getTracks().forEach((track) => track.stop());
            recordBtn.style.display = 'inline-flex';
            recordBtn.disabled = false;
            recordBtn.textContent = 'Grabar Consulta';
            stopRecordBtn.style.display = 'none';
            recordingIndicator.style.display = 'none';
            isRecording = false;
        };

        mediaRecorder.start(2000);
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    async function uploadRecording(blob) {
        stopRecordBtn.textContent = 'Subiendo...';
        stopRecordBtn.disabled = true;
        stopRecordBtn.style.display = 'inline-flex';

        const appointmentId = getAppointmentId();
        const fd = new FormData();
        fd.append('video', blob, 'telemedicina-recording.webm');

        try {
            const res = await fetch(buildResourceUrl('telemedicine-recording'), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    ...(getPortalBearer() ? { Authorization: `Bearer ${getPortalBearer()}` } : {})
                },
                body: fd
            });

            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.ok) {
                throw new Error(body.error || 'Fallo HTTP al subir');
            }

            alert('La grabación ha sido almacenada exitosamente en el historial del caso clínico.');
            pendingRequestId = null;
        } catch (error) {
            console.error('Error uploading recording:', error);
            const objectUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = `backup-recording-${appointmentId || 'teleconsulta'}.webm`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            alert('Aviso: Hubo un error guardando en el servidor, así que la grabación se descargó a tu computador como respaldo (' + error.message + '). Por favor súbela manualmente luego.');
        } finally {
            stopRecordBtn.style.display = 'none';
            stopRecordBtn.textContent = 'Detener Grabación';
            stopRecordBtn.disabled = false;
        }
    }
})(window, document);
