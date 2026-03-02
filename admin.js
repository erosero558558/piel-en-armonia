const t = 'adminUiVariant',
    n = 'admin_ui_reset',
    e = 'legacy',
    a = new Set(['legacy', 'sony_v2', 'sony_v3']),
    i = new Set(['1', 'true', 'yes', 'on', 'clear', 'reset']),
    o = new Map([
        ['digit1', 'dashboard'],
        ['digit2', 'appointments'],
        ['digit3', 'callbacks'],
        ['digit4', 'reviews'],
        ['digit5', 'availability'],
        ['digit6', 'queue'],
        ['numpad1', 'dashboard'],
        ['numpad2', 'appointments'],
        ['numpad3', 'callbacks'],
        ['numpad4', 'reviews'],
        ['numpad5', 'availability'],
        ['numpad6', 'queue'],
        ['1', 'dashboard'],
        ['2', 'appointments'],
        ['3', 'callbacks'],
        ['4', 'reviews'],
        ['5', 'availability'],
        ['6', 'queue'],
    ]),
    c = Object.freeze({
        '!': 'digit1',
        '@': 'digit2',
        '#': 'digit3',
        $: 'digit4',
        '%': 'digit5',
        '^': 'digit6',
        '"': 'digit2',
        '&': 'digit6',
    });
function r(t) {
    const n = String(t || '')
        .trim()
        .toLowerCase();
    return a.has(n) ? n : '';
}
function s(n) {
    const e = r(n);
    if (e)
        try {
            localStorage.setItem(t, e);
        } catch (t) {}
}
async function u() {
    const t =
            'function' == typeof AbortController ? new AbortController() : null,
        n = window.setTimeout(() => {
            t && t.abort();
        }, 3500);
    try {
        const n = await fetch('/api.php?resource=features', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            ...(t ? { signal: t.signal } : {}),
        });
        if (!n.ok) return { sony_v2: null, sony_v3: null };
        const e = await n.json(),
            a =
                e && !0 === e.ok && e.data && 'object' == typeof e.data
                    ? e.data
                    : null;
        return {
            sony_v2:
                a && Object.prototype.hasOwnProperty.call(a, 'admin_sony_ui')
                    ? !0 === a.admin_sony_ui
                    : null,
            sony_v3:
                a && Object.prototype.hasOwnProperty.call(a, 'admin_sony_ui_v3')
                    ? !0 === a.admin_sony_ui_v3
                    : null,
        };
    } catch (t) {
        return { sony_v2: null, sony_v3: null };
    } finally {
        window.clearTimeout(n);
    }
}
async function l(t, n, a = {}) {
    const i = r(t);
    if (!i) return e;
    const { persistAllowed: o = !1 } = a;
    if ('legacy' === i) return (o && s('legacy'), 'legacy');
    const c = await n(),
        u = c.sony_v2,
        l = c.sony_v3;
    if ('sony_v2' === i && !1 === u) return (s('legacy'), 'legacy');
    if ('sony_v3' === i) {
        if (!1 === l) {
            const t = !0 === u ? 'sony_v2' : 'legacy';
            return (s(t), t);
        }
        if (!1 === u) return (s('legacy'), 'legacy');
    }
    return (o && s(i), i);
}
function d(t) {
    document.documentElement.setAttribute('data-admin-ui', t);
}
function y(t) {
    document.documentElement.setAttribute(
        'data-admin-ready',
        t ? 'true' : 'false'
    );
}
function f(t) {
    const n = [
            document.getElementById('adminLegacyBaseStyles'),
            document.getElementById('adminLegacyMinStyles'),
            document.getElementById('adminLegacyStyles'),
        ],
        e = document.getElementById('adminV2Styles'),
        a = document.getElementById('adminV3Styles'),
        i = 'legacy' === t,
        o = 'sony_v2' === t,
        c = 'sony_v3' === t;
    (n.forEach((t) => {
        t instanceof HTMLLinkElement && (t.disabled = !i);
    }),
        e instanceof HTMLLinkElement && (e.disabled = !o),
        a instanceof HTMLLinkElement && (a.disabled = !c));
}
async function m(t, n = '') {
    if (!t || 'object' != typeof t) return;
    if (n) {
        const e = t[n];
        if ('function' == typeof e) return void (await e());
    }
    const e = t.default;
    'function' != typeof e
        ? e && 'function' == typeof e.then && (await e)
        : await e();
}
async function w(t) {
    'sony_v3' !== t
        ? 'sony_v2' !== t
            ? await (async function () {
                  const t =
                      await import('./js/admin-chunks/legacy-index-CzSo9Nse.js');
                  await m(t, 'bootLegacyAdminAuto');
              })()
            : await (async function () {
                  const t = await import('./js/admin-chunks/index-CDhIDYG9.js');
                  await m(t);
              })()
        : await (async function () {
              const t = await import('./js/admin-chunks/index-Dsug4dp8.js');
              await m(t);
          })();
}
!(async function () {
    y(!1);
    const a = (function () {
            const t = (t) => {
                if (
                    'true' ===
                    document.documentElement.getAttribute('data-admin-ready')
                )
                    return;
                if (
                    (n = t.target) instanceof HTMLElement &&
                    (n.isContentEditable ||
                        Boolean(
                            n.closest(
                                'input, textarea, select, [contenteditable="true"]'
                            )
                        ))
                )
                    return;
                var n;
                const e = (function (t) {
                    if (!t.altKey || !t.shiftKey || t.ctrlKey || t.metaKey)
                        return '';
                    const n = String(t.key || '').toLowerCase(),
                        e = String(t.code || '').toLowerCase(),
                        a = [];
                    (e && a.push(e), n && a.push(n));
                    const i = c[n];
                    i && a.push(i);
                    for (const t of a) {
                        const n = o.get(t);
                        if (n) return n;
                    }
                    return '';
                })(t);
                e &&
                    (t.preventDefault(),
                    (function (t) {
                        if (t)
                            try {
                                localStorage.setItem('adminLastSection', t);
                            } catch (t) {}
                    })(e),
                    (function (t) {
                        if (t)
                            try {
                                const n = new URL(window.location.href);
                                ((n.hash = `#${t}`),
                                    window.history.replaceState(
                                        null,
                                        '',
                                        `${n.pathname}${n.search}${n.hash}`
                                    ));
                            } catch (t) {}
                    })(e));
            };
            return (
                window.addEventListener('keydown', t, !0),
                () => window.removeEventListener('keydown', t, !0)
            );
        })(),
        m = (function () {
            try {
                const t = new URL(window.location.href);
                if (!t.searchParams.has(n)) return !1;
                const e = String(t.searchParams.get(n) || '')
                    .trim()
                    .toLowerCase();
                return !e || i.has(e);
            } catch (t) {
                return !1;
            }
        })();
    m &&
        (function (t) {
            try {
                const n = new URL(window.location.href);
                if (!n.searchParams.has(t)) return;
                n.searchParams.delete(t);
                const e = n.searchParams.toString(),
                    a = `${n.pathname}${e ? `?${e}` : ''}${n.hash}`;
                window.history.replaceState(null, '', a);
            } catch (t) {}
        })(n);
    try {
        const n = await (async function (
            { resetStorage: n } = { resetStorage: !1 }
        ) {
            let a;
            n &&
                (function () {
                    try {
                        localStorage.removeItem(t);
                    } catch (t) {}
                })();
            const i = async () => (void 0 !== a || (a = await u()), a),
                o = (function () {
                    try {
                        return r(
                            new URL(window.location.href).searchParams.get(
                                'admin_ui'
                            )
                        );
                    } catch (t) {
                        return '';
                    }
                })();
            if (o) return l(o, i, { persistAllowed: !n });
            const c = n
                ? ''
                : (function () {
                      try {
                          return r(localStorage.getItem(t));
                      } catch (t) {
                          return '';
                      }
                  })();
            if (c) return l(c, i, { persistAllowed: !1 });
            const d = await i();
            return !0 === d.sony_v3
                ? (s('sony_v3'), 'sony_v3')
                : !0 === d.sony_v2
                  ? (s('sony_v2'), 'sony_v2')
                  : e;
        })({ resetStorage: m });
        (d(n), f(n));
        try {
            (await w(n), y(!0));
        } catch (t) {
            const e = await (async function (t) {
                return 'sony_v3' === t && !1 !== (await u()).sony_v2
                    ? 'sony_v2'
                    : 'legacy';
            })(n);
            if (e !== n) return (d(e), f(e), s(e), await w(e), void y(!0));
            throw (y(!1), t);
        }
    } catch (t) {
        throw (y(!1), t);
    } finally {
        a();
    }
})();
