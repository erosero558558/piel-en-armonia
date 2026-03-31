(function(window, document) {
    'use strict';

    let api = null;
    let role = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let patientParticipantId = null;

    const recordBtn = document.getElementById('record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const consentModal = document.getElementById('recording-consent-modal');
    const denyBtn = document.getElementById('deny-recording-btn');
    const acceptBtn = document.getElementById('accept-recording-btn');

    document.addEventListener('telemedicine:ready', (event) => {
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

    function setupModeratorListeners() {
        recordBtn.addEventListener('click', () => {
            const participants = api.getParticipantsInfo();
            const patient = participants.find(p => p.role !== 'moderator');
            
            if (!patient) {
                alert('Aún no hay ningún paciente en la sala para solicitar el consenso.');
                return;
            }

            patientParticipantId = patient.participantId;
            recordBtn.disabled = true;
            recordBtn.textContent = 'Solicitando permiso...';
            
            api.executeCommand('sendEndpointTextMessage', patientParticipantId, JSON.stringify({
                type: 'RECORDING_REQUEST'
            }));
        });

        stopRecordBtn.addEventListener('click', stopRecording);

        api.addEventListener('endpointTextMessageReceived', (event) => {
            try {
                const message = JSON.parse(event.data.text);
                if (message.type === 'RECORDING_CONSENT_GRANTED') {
                    startRecordingWrapper();
                } else if (message.type === 'RECORDING_CONSENT_DENIED') {
                    alert('El paciente ha denegado el permiso para grabar la consulta.');
                    recordBtn.disabled = false;
                    recordBtn.textContent = 'Grabar Consulta';
                }
            } catch (e) {
                console.error('Error parsing endpoint message', e);
            }
        });
    }

    function setupParticipantListeners() {
        api.addEventListener('endpointTextMessageReceived', (event) => {
            try {
                const message = JSON.parse(event.data.text);
                if (message.type === 'RECORDING_REQUEST') {
                    const moderatorId = event.data.senderInfo.id;
                    showConsentModal(moderatorId);
                }
            } catch (e) {
                console.error('Error parsing endpoint message', e);
            }
        });

        api.addEventListener('videoConferenceLeft', () => {
            if (isRecording) stopRecording();
        });
    }

    function showConsentModal(moderatorId) {
        consentModal.classList.remove('hidden');

        denyBtn.onclick = () => {
            consentModal.classList.add('hidden');
            api.executeCommand('sendEndpointTextMessage', moderatorId, JSON.stringify({
                type: 'RECORDING_CONSENT_DENIED'
            }));
        };

        acceptBtn.onclick = () => {
            consentModal.classList.add('hidden');
            api.executeCommand('sendEndpointTextMessage', moderatorId, JSON.stringify({
                type: 'RECORDING_CONSENT_GRANTED'
            }));
        };
    }

    async function startRecordingWrapper() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "browser", width: { ideal: 1280 }, frameRate: { ideal: 15 } },
                audio: true 
            });

            // If we also want the doctor's microphone, we can request it and merge streams:
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStream.getAudioTracks().forEach(track => {
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
            console.error("Error starting screen capture: ", err);
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

        mediaRecorder.ondataavailable = function (e) {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = function () {
            const blob = new Blob(recordedChunks, { type: options.mimeType });
            uploadRecording(blob);
            
            stream.getTracks().forEach(track => track.stop());
            recordBtn.style.display = 'inline-flex';
            recordBtn.disabled = false;
            recordBtn.textContent = 'Grabar Consulta';
            stopRecordBtn.style.display = 'none';
            recordingIndicator.style.display = 'none';
            isRecording = false;
        };

        mediaRecorder.start(2000); // 2 seconds chunks to keep memory usage lower
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    async function uploadRecording(blob) {
        stopRecordBtn.textContent = 'Subiendo...';
        stopRecordBtn.disabled = true;
        stopRecordBtn.style.display = 'inline-flex'; // show while uploading

        const appointmentId = getAppointmentId();
        const token = getTokenParam(); // if there is a reschedule token, but usually doctor uses ?id= for admin backend
        const fd = new FormData();
        fd.append('video', blob, 'telemedicina-recording.webm');
        
        let url = `/api.php?resource=telemedicine-recording`;
        if (appointmentId) url += `&id=${appointmentId}`;
        else if (token) url += `&token=${token}`;

        // Get admin token if available (cookie or local storage)
        // Usually admin requests are cookie-based, so fetch will send cookies automatically.
        // We'll also try to extract bearer token if they are from a portal session for any reason.
        const portalShell = window.AuroraPatientPortalShell || null;
        const session = portalShell && typeof portalShell.getSession === 'function' ? portalShell.getSession() : null;
        const bearer = session ? session.token : null;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
                },
                body: fd
            });
            
            const body = await res.json().catch(() => ({}));
            
            if (!res.ok || !body.ok) {
                throw new Error(body.error || 'Fallo HTTP al subir');
            }

            alert('La grabación ha sido almacenada exitosamente en el historial del caso clínico.');

        } catch (error) {
            console.error('Error uploading recording:', error);
            // Fallback for safety so doctor doesn't lose the video if upload fails!
            const objectUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = `backup-recording-${appointmentId}.webm`;
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
