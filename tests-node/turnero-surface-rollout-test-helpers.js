'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');

function defineGlobal(name, value) {
    Object.defineProperty(global, name, {
        value,
        configurable: true,
        writable: true,
        enumerable: true,
    });
}

function restoreGlobal(name, value) {
    if (value === undefined) {
        delete global[name];
        return;
    }

    defineGlobal(name, value);
}

function readJson(relativePath) {
    return JSON.parse(readFileSync(resolve(REPO_ROOT, relativePath), 'utf8'));
}

function installLocalStorageMock() {
    const previous = global.localStorage;
    const store = new Map();

    defineGlobal('localStorage', {
        getItem(key) {
            const normalizedKey = String(key);
            return store.has(normalizedKey) ? store.get(normalizedKey) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
        entries() {
            return Array.from(store.entries());
        },
    });

    return {
        store,
        cleanup() {
            restoreGlobal('localStorage', previous);
        },
    };
}

class FakeElement {
    constructor(tagName = 'div', ownerDocument = null) {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.className = '';
        this.hidden = false;
        this.style = {};
        this.attributes = new Map();
        this._selectorCache = new Map();
        this._id = '';
        this._innerHTML = '';
        this._textContent = '';
        this.onclick = null;
    }

    set id(value) {
        this._id = String(value || '');
        if (this.ownerDocument) {
            this.ownerDocument.registerId(this);
        }
    }

    get id() {
        return this._id;
    }

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this._textContent = '';
        this.children = [];
        this._selectorCache.clear();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set textContent(value) {
        this._textContent = String(value ?? '');
        this._innerHTML = '';
        this.children = [];
        this._selectorCache.clear();
    }

    get textContent() {
        if (this._textContent) {
            return this._textContent;
        }
        if (this.children.length > 0) {
            return this.children
                .map((child) => String(child.textContent || ''))
                .join('');
        }
        return this._innerHTML;
    }

    appendChild(child) {
        if (!(child instanceof FakeElement)) {
            throw new TypeError(
                'FakeElement only accepts FakeElement children'
            );
        }

        child.parentElement = this;
        child.ownerDocument = this.ownerDocument;
        this.children.push(child);
        if (child.id && child.ownerDocument) {
            child.ownerDocument.registerId(child);
        }
        return child;
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._innerHTML = '';
        this._textContent = '';
        this._selectorCache.clear();
        nodes.filter(Boolean).forEach((node) => this.appendChild(node));
    }

    remove() {
        if (this.parentElement) {
            const index = this.parentElement.children.indexOf(this);
            if (index >= 0) {
                this.parentElement.children.splice(index, 1);
            }
            this.parentElement = null;
        }
        if (this.ownerDocument) {
            this.ownerDocument.unregisterId(this);
        }
    }

    setAttribute(name, value) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            this.id = value;
            return;
        }
        if (normalizedName === 'class') {
            this.className = String(value || '');
            return;
        }
        this.attributes.set(normalizedName, String(value || ''));
    }

    getAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            return this.id || null;
        }
        if (normalizedName === 'class') {
            return this.className || null;
        }
        return this.attributes.has(normalizedName)
            ? this.attributes.get(normalizedName)
            : null;
    }

    removeAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            this.id = '';
            return;
        }
        if (normalizedName === 'class') {
            this.className = '';
            return;
        }
        this.attributes.delete(normalizedName);
    }

    click() {
        if (typeof this.onclick === 'function') {
            return this.onclick({
                type: 'click',
                target: this,
                currentTarget: this,
                preventDefault() {},
                stopPropagation() {},
            });
        }

        return undefined;
    }

    _queryRolloutPlaceholder(selector) {
        if (this._selectorCache.has(selector)) {
            return this._selectorCache.get(selector);
        }

        const match = selector.match(
            /^\[(data-turnero-surface-rollout-(?:banner|chips))="([^"]+)"\]$/
        );
        if (!match) {
            return null;
        }

        const placeholder = new FakeElement('div', this.ownerDocument);
        const [, attributeName, surfaceKey] = match;
        const datasetKey =
            attributeName === 'data-turnero-surface-rollout-banner'
                ? 'turneroSurfaceRolloutBanner'
                : 'turneroSurfaceRolloutChips';
        placeholder.dataset[datasetKey] = surfaceKey;
        placeholder.setAttribute(attributeName, surfaceKey);
        this._selectorCache.set(selector, placeholder);
        return placeholder;
    }

    querySelector(selector) {
        const placeholder = this._queryRolloutPlaceholder(selector);
        if (placeholder) {
            return placeholder;
        }

        return null;
    }

    querySelectorAll(selector) {
        if (selector === '[data-action]') {
            if (this._selectorCache.has(selector)) {
                return this._selectorCache.get(selector);
            }

            const buttons = [];
            const buttonRegex = /<button\b([^>]*)>/gi;
            let match = buttonRegex.exec(this._innerHTML);
            while (match) {
                const attributes = match[1] || '';
                const actionMatch = attributes.match(/data-action="([^"]+)"/i);
                if (actionMatch) {
                    const button = new FakeButton('button', this.ownerDocument);
                    button.dataset.action = actionMatch[1];
                    const surfaceMatch = attributes.match(
                        /data-surface="([^"]+)"/i
                    );
                    if (surfaceMatch) {
                        button.dataset.surface = surfaceMatch[1];
                    }
                    buttons.push(button);
                }
                match = buttonRegex.exec(this._innerHTML);
            }

            this._selectorCache.set(selector, buttons);
            return buttons;
        }

        const placeholder = this._queryRolloutPlaceholder(selector);
        return placeholder ? [placeholder] : [];
    }
}

class FakeButton extends FakeElement {}

class FakeDocument {
    constructor() {
        this._ids = new Map();
        this.head = new FakeElement('head', this);
        this.body = new FakeElement('body', this);
    }

    registerId(element) {
        if (element && element.id) {
            this._ids.set(element.id, element);
        }
    }

    unregisterId(element) {
        if (element && element.id && this._ids.get(element.id) === element) {
            this._ids.delete(element.id);
        }
    }

    createElement(tagName) {
        const normalized = String(tagName || 'div').toLowerCase();
        const element =
            normalized === 'button'
                ? new FakeButton(tagName, this)
                : new FakeElement(tagName, this);
        return element;
    }

    getElementById(id) {
        return this._ids.get(String(id)) || null;
    }

    querySelector(selector) {
        return (
            this.body.querySelector(selector) ||
            this.head.querySelector(selector)
        );
    }

    querySelectorAll(selector) {
        return [
            ...this.body.querySelectorAll(selector),
            ...this.head.querySelectorAll(selector),
        ];
    }
}

function installFakeDom() {
    const previous = {
        document: global.document,
        HTMLElement: global.HTMLElement,
        HTMLButtonElement: global.HTMLButtonElement,
        Blob: global.Blob,
        URL: global.URL,
        navigator: global.navigator,
        setTimeout: global.setTimeout,
    };

    const clipboardWrites = [];

    const fakeDocument = new FakeDocument();
    defineGlobal('document', fakeDocument);
    defineGlobal('HTMLElement', FakeElement);
    defineGlobal('HTMLButtonElement', FakeButton);
    defineGlobal(
        'Blob',
        class FakeBlob {
            constructor(parts, options = {}) {
                this.parts = parts;
                this.type = options.type || '';
            }
        }
    );
    defineGlobal('URL', {
        createObjectURL(blob) {
            global.__createdTurneroBlobs = global.__createdTurneroBlobs || [];
            global.__createdTurneroBlobs.push(blob);
            return 'blob:turnero-rollout';
        },
        revokeObjectURL() {},
    });
    defineGlobal('navigator', {
        clipboard: {
            async writeText(value) {
                clipboardWrites.push(String(value));
                return undefined;
            },
        },
    });

    return {
        document: fakeDocument,
        clipboardWrites,
        cleanup() {
            restoreGlobal('document', previous.document);
            restoreGlobal('HTMLElement', previous.HTMLElement);
            restoreGlobal('HTMLButtonElement', previous.HTMLButtonElement);
            restoreGlobal('Blob', previous.Blob);
            restoreGlobal('URL', previous.URL);
            restoreGlobal('navigator', previous.navigator);
            restoreGlobal('setTimeout', previous.setTimeout);
        },
    };
}

module.exports = {
    FakeButton,
    FakeDocument,
    FakeElement,
    installFakeDom,
    installLocalStorageMock,
    readJson,
};
