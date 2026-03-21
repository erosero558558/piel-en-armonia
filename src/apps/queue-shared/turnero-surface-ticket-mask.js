function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeTicketToken(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function normalizeMaskedTicket(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9*]/g, '');
}

function normalizePrivacyMode(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'full' || normalized === 'open') {
        return 'full';
    }
    return 'masked';
}

export function maskTurneroTicket(value = '', mode = 'masked') {
    const token = normalizeTicketToken(value);
    if (!token) {
        return '';
    }
    if (normalizePrivacyMode(mode) === 'full') {
        return token;
    }
    if (token.length <= 2) {
        return `${token[0] || ''}*`;
    }
    return `${token.slice(0, 1)}${'*'.repeat(
        Math.max(1, token.length - 2)
    )}${token.slice(-1)}`;
}

export function buildTurneroSurfaceTicketMaskState(input = {}) {
    const ticketDisplay = normalizeTicketToken(
        input.ticketDisplay || input.visibleTurn
    );
    const privacyMode = normalizePrivacyMode(input.privacyMode);
    const explicitMaskedTicket = normalizeMaskedTicket(input.maskedTicket);
    const hasExplicitMaskedTicket = explicitMaskedTicket !== '';
    const maskedTicket = hasExplicitMaskedTicket
        ? explicitMaskedTicket
        : maskTurneroTicket(ticketDisplay, privacyMode);

    let state = 'missing';
    if (ticketDisplay) {
        if (privacyMode === 'full') {
            state = 'open';
        } else if (!hasExplicitMaskedTicket) {
            state = 'watch';
        } else if (
            normalizeTicketToken(explicitMaskedTicket) === ticketDisplay
        ) {
            state = 'watch';
        } else {
            state = 'protected';
        }
    }

    return {
        ticketDisplay,
        maskedTicket,
        privacyMode,
        state,
        generatedAt: new Date().toISOString(),
    };
}
