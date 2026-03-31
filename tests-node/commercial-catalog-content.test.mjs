import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    getBookingOptions,
    getServices,
} from '../src/apps/astro/src/lib/content.js';

test('commercial catalog exposes 13 public routes from the canonical file', () => {
    const services = getServices();

    assert.equal(services.length, 13);
    assert.equal(services[0]?.slug, 'diagnostico-integral');
    assert.equal(services[0]?.preparation, 'Llega 10 minutos antes y trae tus medicamentos, examenes o fotos previas si ayudan a explicar la evolucion.');
    assert.equal(services[0]?.runtime_service_id, 'consulta');
});

test('commercial catalog exposes 7 booking options from the canonical file', () => {
    const options = getBookingOptions();
    const ids = options.map((option) => option.id);

    assert.equal(options.length, 7);
    assert.deepEqual(ids, [
        'consulta',
        'telefono',
        'video',
        'acne',
        'cancer',
        'laser',
        'rejuvenecimiento',
    ]);
    assert.equal(options[0]?.base_price_usd, 40);
    assert.equal(options[5]?.tax_rate, 0.15);
});

test('cross-sell catalog maps one visible suggestion per booking service', () => {
    const filePath = path.resolve('data/catalog/cross-sell.json');
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    const ids = suggestions.map((entry) => String(entry?.service_id || '').trim());

    assert.equal(suggestions.length, 7);
    assert.deepEqual(ids, [
        'consulta',
        'telefono',
        'video',
        'acne',
        'cancer',
        'laser',
        'rejuvenecimiento',
    ]);
    assert.equal(String(suggestions[5]?.title_es || ''), 'Mesoterapia');
    assert.equal(String(suggestions[6]?.href || ''), '/servicios/botox.html');
});
