import fs from 'node:fs';
import path from 'node:path';

// Astro build CWD is src/apps/astro
export function getWhatsappNumber() {
    try {
        const configPath = path.resolve('../../../data/clinic-config.json');
        const clinicConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return clinicConfig.whatsapp.replace('+', '');
    } catch (err) {
        console.error('Failed to load clinic config for WhatsApp fallback:', err);
        return '593982453672'; // fallback
    }
}
