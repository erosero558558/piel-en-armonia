#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

test('desktop shell support formats platform labels and metadata feed urls', async () => {
    const support = await importRepoModule(
        'src/apps/queue-shared/desktop-shell-support.mjs'
    );

    assert.equal(
        support.formatDesktopPlatformLabel('win32', {
            fallbackLabel: 'Equipo local',
        }),
        'Windows'
    );
    assert.equal(
        support.formatDesktopPlatformLabel('', {
            fallbackLabel: 'Equipo local',
        }),
        'Equipo local'
    );
    assert.equal(
        support.buildDesktopUpdateMetadataUrl({
            updateFeedUrl:
                'https://pielarmonia.com/desktop-updates/stable/operator/win/',
            platform: 'win32',
        }),
        'https://pielarmonia.com/desktop-updates/stable/operator/win/latest.yml'
    );
    assert.equal(
        support.buildDesktopUpdateMetadataUrl({
            updateFeedUrl:
                'https://pielarmonia.com/desktop-updates/stable/operator/mac/',
            platform: 'darwin',
        }),
        'https://pielarmonia.com/desktop-updates/stable/operator/mac/latest-mac.yml'
    );
});

test('desktop shell support derives install guide urls for operator and kiosk surfaces', async () => {
    const support = await importRepoModule(
        'src/apps/queue-shared/desktop-shell-support.mjs'
    );

    assert.equal(
        support.buildDesktopSupportGuideUrl({
            baseUrl: 'https://pielarmonia.com',
            surface: 'operator',
            platform: 'win32',
            stationMode: 'locked',
            stationConsultorio: 2,
            oneTap: true,
        }),
        'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
    );
    assert.equal(
        support.buildDesktopSupportGuideUrl({
            baseUrl: 'https://pielarmonia.com',
            surface: 'kiosk',
            platform: 'darwin',
        }),
        'https://pielarmonia.com/app-downloads/?surface=kiosk&platform=mac'
    );
    assert.equal(
        support.buildDesktopSupportGuideUrl({
            baseUrl: 'https://pielarmonia.com',
            surface: 'sala_tv',
            platform: 'linux',
        }),
        'https://pielarmonia.com/app-downloads/?surface=sala_tv&platform=android_tv'
    );
});
