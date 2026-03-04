#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const esDir = path.join(ROOT, 'content', 'public-v6', 'es');
const enDir = path.join(ROOT, 'content', 'public-v6', 'en');
const outDir = path.join(ROOT, 'verification', 'public-v6-copy');

const bannedPatterns = [
    /\bgarantizado\b/i,
    /\b100%\b/i,
    /\bcura definitiva\b/i,
    /\bsin riesgos\b/i,
    /\bguaranteed\b/i,
    /\bdefinitive cure\b/i,
    /\brisk[- ]free\b/i,
];

const technicalPatterns = [
    /\bbridge\b/i,
    /\bruntime\b/i,
    /\bshell\b/i,
    /\bv3\b/i,
    /\bv4\b/i,
    /\bv5\b/i,
];
const tuteoPattern = /\b(tu|tus|contigo|te\s+acompanamos|te\s+guiamos)\b/i;
const mechanicalPatternsByLocale = {
    es: [
        /\bprotocolo,\s*evidencia\s*y\s*seguimiento\b/i,
        /\bnunca promesas vacias\b/i,
        /\bbloque corporativo\b/i,
        /\brecalibracion v6\b/i,
    ],
    en: [
        /\bprotocol,\s*evidence,\s*follow-up\b/i,
        /\bnever empty promises\b/i,
        /\bcorporate block\b/i,
        /\bv6 recalibration\b/i,
    ],
};
const terminologyRequiredByLocale = {
    es: ['telemedicina', 'diagnostico', 'seguimiento'],
    en: ['telemedicine', 'diagnosis', 'follow-up'],
};
const terminologyDeprecatedByLocale = {
    es: [/bloque corporativo/i, /extension de programa/i],
    en: [/corporate block/i, /program extension/i],
};

function isPathLike(text) {
    const value = String(text || '').trim();
    if (!value) return true;
    if (value.startsWith('/')) return true;
    if (/^[a-z0-9/_:.-]+$/i.test(value) && !/\s/.test(value)) return true;
    return false;
}

function walkJsonFiles(dir) {
    return fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => path.join(dir, name));
}

function flattenStrings(value, collector) {
    if (typeof value === 'string') {
        collector.push(value);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => flattenStrings(item, collector));
        return;
    }
    if (value && typeof value === 'object') {
        Object.values(value).forEach((item) => flattenStrings(item, collector));
    }
}

function countWords(text) {
    return String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

function checkMaxWords(locale, file, findings, value, maxWords, type) {
    if (typeof value !== 'string' || !value.trim()) return;
    const words = countWords(value);
    if (words > maxWords) {
        findings.push({
            locale,
            file,
            type,
            message: `Word count ${words} exceeds max ${maxWords}`,
            text: value,
        });
    }
}

function inspectStructuredCopy(locale, rel, payload, findings) {
    if (rel.endsWith('/home.json')) {
        const heroSlides = Array.isArray(payload?.hero?.slides)
            ? payload.hero.slides
            : [];
        heroSlides.forEach((slide) => {
            checkMaxWords(
                locale,
                rel,
                findings,
                slide?.title,
                12,
                'copy_length.hero_title'
            );
            checkMaxWords(
                locale,
                rel,
                findings,
                slide?.description,
                28,
                'copy_length.hero_description'
            );
        });
        checkMaxWords(
            locale,
            rel,
            findings,
            payload?.newsStrip?.headline,
            22,
            'copy_length.news_headline'
        );
        checkMaxWords(
            locale,
            rel,
            findings,
            payload?.bookingStatus?.description,
            30,
            'copy_length.booking_description'
        );
        const editorialCards = Array.isArray(payload?.editorial?.cards)
            ? payload.editorial.cards
            : [];
        editorialCards.forEach((card) => {
            checkMaxWords(
                locale,
                rel,
                findings,
                card?.title,
                12,
                'copy_length.card_title'
            );
            checkMaxWords(
                locale,
                rel,
                findings,
                card?.copy,
                24,
                'copy_length.card_copy'
            );
        });
    }

    if (rel.endsWith('/hub.json')) {
        const sections = Array.isArray(payload?.sections)
            ? payload.sections
            : [];
        sections.forEach((section) => {
            checkMaxWords(
                locale,
                rel,
                findings,
                section?.title,
                10,
                'copy_length.section_title'
            );
            const cards = Array.isArray(section?.cards) ? section.cards : [];
            cards.forEach((card) => {
                checkMaxWords(
                    locale,
                    rel,
                    findings,
                    card?.title,
                    11,
                    'copy_length.card_title'
                );
                checkMaxWords(
                    locale,
                    rel,
                    findings,
                    card?.copy,
                    22,
                    'copy_length.card_copy'
                );
            });
        });
    }
}

function inspectTerminologyConsistency(locale, dir, findings) {
    const required = terminologyRequiredByLocale[locale] || [];
    const deprecated = terminologyDeprecatedByLocale[locale] || [];
    const files = [
        'home.json',
        'hub.json',
        'service.json',
        'telemedicine.json',
    ];

    files.forEach((name) => {
        const filePath = path.join(dir, name);
        if (!fs.existsSync(filePath)) return;
        const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const strings = [];
        flattenStrings(payload, strings);
        const text = strings.join(' ').toLowerCase();

        required.forEach((term) => {
            if (!text.includes(term.toLowerCase())) {
                findings.push({
                    locale,
                    file: rel,
                    type: 'terminology_missing',
                    message: `Missing required term: ${term}`,
                });
            }
        });

        deprecated.forEach((pattern) => {
            const match = strings.find((value) => pattern.test(value));
            if (match) {
                findings.push({
                    locale,
                    file: rel,
                    type: 'terminology_deprecated',
                    text: match,
                    pattern: String(pattern),
                });
            }
        });
    });
}

function inspectLocale(locale, dir) {
    const files = walkJsonFiles(dir);
    const findings = [];

    files.forEach((filePath) => {
        const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
        const baseName = path.basename(filePath);
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const strings = [];
        flattenStrings(payload, strings);
        inspectStructuredCopy(locale, rel, payload, findings);

        strings.forEach((text) => {
            bannedPatterns.forEach((pattern) => {
                if (pattern.test(text)) {
                    findings.push({
                        locale,
                        file: rel,
                        type: 'banned_claim',
                        pattern: String(pattern),
                        text,
                    });
                }
            });

            technicalPatterns.forEach((pattern) => {
                if (pattern.test(text)) {
                    findings.push({
                        locale,
                        file: rel,
                        type: 'technical_visible',
                        pattern: String(pattern),
                        text,
                    });
                }
            });

            if (locale === 'es' && tuteoPattern.test(text)) {
                findings.push({
                    locale,
                    file: rel,
                    type: 'tuteo_detected',
                    text,
                });
            }

            (mechanicalPatternsByLocale[locale] || []).forEach((pattern) => {
                if (pattern.test(text)) {
                    findings.push({
                        locale,
                        file: rel,
                        type: 'mechanical_phrase',
                        pattern: String(pattern),
                        text,
                    });
                }
            });
        });

        const requiresUsted =
            locale === 'es' &&
            [
                'home.json',
                'hub.json',
                'service.json',
                'telemedicine.json',
            ].includes(baseName);

        if (requiresUsted && !strings.some((text) => /\busted\b/i.test(text))) {
            findings.push({
                locale,
                file: rel,
                type: 'usted_missing',
                message: 'No se detecto uso explicito de "usted".',
            });
        }

        if (locale === 'es') {
            const englishLeak = strings.find(
                (text) =>
                    !isPathLike(text) &&
                    /\b(the|learn more|schedule|privacy policy)\b/i.test(text)
            );
            if (englishLeak) {
                findings.push({
                    locale,
                    file: rel,
                    type: 'language_mix',
                    text: englishLeak,
                });
            }
        }

        if (locale === 'en') {
            const spanishLeak = strings.find(
                (text) =>
                    !isPathLike(text) &&
                    /\b(usted|servicios|telemedicina|aviso medico)\b/i.test(
                        text
                    )
            );
            if (spanishLeak) {
                findings.push({
                    locale,
                    file: rel,
                    type: 'language_mix',
                    text: spanishLeak,
                });
            }
        }
    });

    inspectTerminologyConsistency(locale, dir, findings);

    return { locale, files: files.length, findings };
}

function run() {
    const strict = process.argv.includes('--strict');
    const es = inspectLocale('es', esDir);
    const en = inspectLocale('en', enDir);

    const findings = [...es.findings, ...en.findings];
    const result = {
        ok: findings.length === 0,
        strict,
        summary: {
            es_files: es.files,
            en_files: en.files,
            findings: findings.length,
        },
        findings,
    };

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, 'audit.json'),
        `${JSON.stringify(result, null, 2)}\n`,
        'utf8'
    );

    const mdLines = [
        '# Public V6 Copy Audit',
        '',
        `- ES files: **${es.files}**`,
        `- EN files: **${en.files}**`,
        `- Findings: **${findings.length}**`,
        '',
    ];

    if (!findings.length) {
        mdLines.push('No issues detected.');
    } else {
        mdLines.push('| Locale | File | Type | Note |');
        mdLines.push('|---|---|---|---|');
        findings.forEach((finding) => {
            mdLines.push(
                `| ${finding.locale} | ${finding.file} | ${finding.type} | ${(finding.text || finding.message || '').replace(/\|/g, '\\/')} |`
            );
        });
    }

    fs.writeFileSync(
        path.join(outDir, 'audit.md'),
        `${mdLines.join('\n')}\n`,
        'utf8'
    );

    if (!result.ok && strict) {
        console.error(JSON.stringify(result, null, 2));
        process.exit(1);
    }

    console.log(
        JSON.stringify({ ok: result.ok, findings: findings.length }, null, 2)
    );
}

run();
