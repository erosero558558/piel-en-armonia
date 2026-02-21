
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications not supported');
        const btn = document.getElementById('subscribePushBtn');
        if (btn) btn.style.display = 'none';
        return;
    }

    // Register Service Worker explicitly for Admin Panel
    try {
        await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
        console.error('Service Worker registration failed:', error);
    }

    const subscribeBtn = document.getElementById('subscribePushBtn');
    const testPushBtn = document.getElementById('testPushBtn');

    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', toggleSubscription);
    }

    if (testPushBtn) {
        testPushBtn.addEventListener('click', sendTestNotification);
    }

    await checkSubscriptionState();
}

async function checkSubscriptionState() {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    updateSubscriptionUI(!!subscription);
}

function updateSubscriptionUI(isSubscribed) {
    const btn = document.getElementById('subscribePushBtn');
    if (!btn) return;

    if (isSubscribed) {
        btn.innerHTML = '<i class="fas fa-bell-slash"></i> Desactivar Notificaciones';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        btn.dataset.action = 'unsubscribe';
    } else {
        btn.innerHTML = '<i class="fas fa-bell"></i> Activar Notificaciones';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        btn.dataset.action = 'subscribe';
    }
}

async function toggleSubscription() {
    const btn = document.getElementById('subscribePushBtn');
    const action = btn.dataset.action;

    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        if (action === 'unsubscribe') {
            await unsubscribeFromPush();
        } else {
            await subscribeToPush();
        }
    } catch (error) {
        console.error('Push error:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        await checkSubscriptionState();
    }
}

async function subscribeToPush() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
        throw new Error('Permiso de notificaciones denegado.');
    }

    const reg = await navigator.serviceWorker.ready;

    // Fetch VAPID Key
    const response = await fetch('/api.php?resource=push-config');
    const config = await response.json();

    if (!config.ok || !config.publicKey) {
        throw new Error('No se pudo obtener la configuración del servidor.');
    }

    const applicationServerKey = urlBase64ToUint8Array(config.publicKey);

    // Subscribe
    const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
    });

    // Send to Backend
    const saveRes = await fetch('/api.php?resource=push-subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription })
    });

    if (!saveRes.ok) {
        // Rollback local subscription if server fails?
        // await subscription.unsubscribe();
        throw new Error('Error guardando suscripción en el servidor.');
    }

    alert('Notificaciones activadas correctamente.');
}

async function unsubscribeFromPush() {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (!subscription) return;

    // Send to backend
    await fetch('/api.php?resource=push-unsubscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
    });

    // Unsubscribe locally
    await subscription.unsubscribe();
    alert('Notificaciones desactivadas.');
}

async function sendTestNotification() {
    const btn = document.getElementById('testPushBtn');
    const originalIcon = btn.querySelector('i').className;
    btn.querySelector('i').className = 'fas fa-spinner fa-spin';
    btn.disabled = true;

    try {
        const res = await fetch('/api.php?resource=push-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.ok) {
            // Success
            // Check result counts
            const successCount = data.result.success || 0;
            const failedCount = data.result.failed || 0;
            alert(`Notificación enviada. Éxito: ${successCount}, Fallidos: ${failedCount}`);
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
    } catch (error) {
        alert('Error enviando test: ' + error.message);
    } finally {
        btn.querySelector('i').className = originalIcon;
        btn.disabled = false;
    }
}
