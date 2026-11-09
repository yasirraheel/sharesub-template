(function() {
    'use strict';

    if (!window.MLP_POPUP_CONFIG && window.MLP_POPUPS) {
        window.MLP_POPUP_CONFIG = window.MLP_POPUPS;
    } else if (!window.MLP_POPUPS && window.MLP_POPUP_CONFIG) {
        window.MLP_POPUPS = window.MLP_POPUP_CONFIG;
    }

    const config = window.MLP_POPUP_CONFIG;
    if (!config || !Array.isArray(config.popups) || !config.popups.length) {
        return;
    }

    const doc = document;
    const container = doc.querySelector('.mlp-popups-container');
    if (!container) {
        return;
    }

    const body = doc.body || doc.documentElement;
    const root = doc.documentElement;
    const state = {
        startTime: Date.now(),
        userInteracted: false,
    };

    const CAP_PREFIX = 'mlpPopup:';
    const device = isMobileViewport() ? 'mobile' : 'desktop';

    const storage = {
        session: createStorage('session'),
        local: createStorage('local'),
    };

    const memoryCaps = {
        session: {},
        days: {},
    };

    const dismissedRegistry = {};
    const COOKIE_PREFIX = 'mlpPopup';

    registerInteractionListeners();

    ready(function init() {
        state.startTime = Date.now();

        const candidates = config.popups
            .filter(function(popup) {
                if (!popup || typeof popup !== 'object') {
                    return false;
                }

                let devices = ['desktop', 'mobile'];
                if (popup.conditions) {
                    if (Array.isArray(popup.conditions.devices)) {
                        devices = popup.conditions.devices;
                    } else if (typeof popup.conditions.devices === 'string' && popup.conditions.devices.length) {
                        devices = popup.conditions.devices.split(',');
                    }
                }

                const matchesDevice = devices
                    .map(function(entry) {
                        if (typeof entry !== 'string') {
                            return entry;
                        }

                        return entry.trim().toLowerCase();
                    })
                    .indexOf(device) !== -1;

                if (!matchesDevice) {
                    return false;
                }

                return matchesUrlConditions(popup.conditions);
            })
            .sort(function(a, b) {
                const ap = typeof a.priority === 'number' ? a.priority : parseInt(a.priority, 10) || 0;
                const bp = typeof b.priority === 'number' ? b.priority : parseInt(b.priority, 10) || 0;

                return ap - bp;
            });

        let instance = null;

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];

            if (isCapped(candidate)) {
                continue;
            }

            const element = container.querySelector('#mlp-popup-' + candidate.id);
            if (!element) {
                continue;
            }

            instance = new PopupInstance(element, candidate);
            break;
        }

        if (!instance) {
            return;
        }

        setupGlobalHandlers(instance);
        instance.arm();

        const rearm = function() {
            if (!instance || instance.visible || instance.dismissed) {
                return;
            }

            if (!matchesUrlConditions(instance.popup.conditions)) {
                instance.cleanupTriggers();
                return;
            }

            instance.cleanupTriggers();
            instance.arm();
        };

        window.addEventListener('popstate', rearm);
        document.addEventListener('mlp:pagechange', rearm);
    });

    function ready(callback) {
        if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function isMobileViewport() {
        if (typeof window.matchMedia !== 'function') {
            return window.innerWidth <= 767;
        }

        return window.matchMedia('(max-width: 767px)').matches;
    }

    function createStorage(type) {
        const key = type + 'Storage';

        try {
            const area = window[key];
            if (!area) {
                return null;
            }

            return {
                get: function(name) {
                    try {
                        return area.getItem(name);
                    } catch (error) {
                        return null;
                    }
                },
                set: function(name, value) {
                    try {
                        area.setItem(name, value);
                    } catch (error) {
                        // ignore
                    }
                },
                remove: function(name) {
                    try {
                        area.removeItem(name);
                    } catch (error) {
                        // ignore
                    }
                },
            };
        } catch (error) {
            return null;
        }
    }

    function cookieKey(scope, id) {
        return COOKIE_PREFIX + '_' + scope + '_' + id;
    }

    function getCookie(name) {
        if (!name || typeof document.cookie !== 'string') {
            return null;
        }

        const cookies = document.cookie ? document.cookie.split('; ') : [];

        for (let i = 0; i < cookies.length; i++) {
            const parts = cookies[i].split('=');
            const key = parts.shift();
            if (key === name) {
                return parts.join('=');
            }
        }

        return null;
    }

    function setCookie(name, value, days) {
        if (!name || typeof document.cookie !== 'string') {
            return;
        }

        let cookie = name + '=' + value + ';path=/';

        if (typeof days === 'number' && days > 0) {
            const date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            cookie += ';expires=' + date.toUTCString();
        }

        document.cookie = cookie;
    }

    function throttleFrame(fn) {
        if (typeof fn !== 'function') {
            return function() {};
        }

        let ticking = false;

        return function() {
            if (ticking) {
                return;
            }

            ticking = true;
            window.requestAnimationFrame(function() {
                ticking = false;
                fn();
            });
        };
    }

    function getAdminBarHeight() {
        const bar = document.getElementById('wpadminbar');

        if (!bar) {
            return 0;
        }

        if (typeof bar.getBoundingClientRect === 'function') {
            const rect = bar.getBoundingClientRect();

            if (rect && rect.height) {
                return rect.height;
            }
        }

        return bar.offsetHeight || 0;
    }

    function registerInteractionListeners() {
        const mark = function() {
            state.userInteracted = true;
        };

        window.addEventListener('pointerdown', mark, {
            passive: true,
            once: true
        });
        if (typeof window.PointerEvent !== 'function') {
            window.addEventListener('mousedown', mark, {
                once: true
            });
        }
        window.addEventListener('keydown', mark, {
            passive: true,
            once: true
        });
        window.addEventListener('scroll', mark, {
            passive: true,
            once: true
        });
    }

    function clampDelay(value) {
        const parsed = typeof value === 'number' ? value : parseInt(value, 10);

        if (isNaN(parsed)) {
            return 1000;
        }

        return Math.min(Math.max(parsed, 0), 3000);
    }

    function isCapped(popup) {
        if (!popup || !popup.id) {
            return true;
        }

        const id = popup.id;

        if (dismissedRegistry[id]) {
            return true;
        }

        if (popup.capping && popup.capping.perSession) {
            if (storage.session && storage.session.get(sessionKey(id))) {
                memoryCaps.session[id] = true;
                return true;
            }

            if (memoryCaps.session[id]) {
                return true;
            }

            if (getCookie(cookieKey('session', id))) {
                memoryCaps.session[id] = true;
                return true;
            }
        }

        const days = popup.capping && popup.capping.perUserDays ? parseInt(popup.capping.perUserDays, 10) : 0;
        if (days > 0 && storage.local) {
            const stored = storage.local.get(daysKey(id));
            if (stored) {
                const expires = parseInt(stored, 10);

                if (!isNaN(expires)) {
                    if (expires > Date.now()) {
                        memoryCaps.days[id] = true;
                        return true;
                    }

                    storage.local.remove(daysKey(id));
                }
            }
        } else if (days > 0) {
            if (getCookie(cookieKey('days' + days, id))) {
                memoryCaps.days[id] = true;
                return true;
            }
        } else if (memoryCaps.days[id]) {
            return true;
        }

        return false;
    }

    function rememberCap(popup) {
        if (!popup || !popup.id) {
            return;
        }

        dismissedRegistry[popup.id] = true;

        if (!popup.capping) {
            return;
        }

        if (popup.capping.perSession) {
            memoryCaps.session[popup.id] = true;

            if (storage.session) {
                storage.session.set(sessionKey(popup.id), String(Date.now()));
            } else {
                setCookie(cookieKey('session', popup.id), '1');
            }
        }

        const days = popup.capping.perUserDays ? parseInt(popup.capping.perUserDays, 10) : 0;
        if (days > 0 && storage.local) {
            const expires = Date.now() + days * 24 * 60 * 60 * 1000;
            storage.local.set(daysKey(popup.id), String(expires));
            memoryCaps.days[popup.id] = true;
        } else if (days > 0) {
            setCookie(cookieKey('days' + days, popup.id), '1', days);
            memoryCaps.days[popup.id] = true;
        }
    }

    function sessionKey(id) {
        return CAP_PREFIX + id + ':session';
    }

    function daysKey(id) {
        return CAP_PREFIX + id + ':days';
    }

    function appendNonce(url, nonce) {
        if (!nonce) {
            return url;
        }

        return url + (url.indexOf('?') === -1 ? '?' : '&') + '_wpnonce=' + encodeURIComponent(nonce);
    }

    function normalizeLanguage(value) {
        if (!value || typeof value !== 'string') {
            return '';
        }

        const cleaned = value.trim().toLowerCase().replace('_', '-');
        if (!cleaned) {
            return '';
        }

        const match = cleaned.match(/^[a-z]{2,3}(-[a-z0-9]{2,4})?/);
        if (!match) {
            return '';
        }

        return match[0];
    }

    function resolveLanguage() {
        const configured = normalizeLanguage(config.language);
        if (configured) {
            return configured;
        }

        if (document && document.documentElement) {
            const lang = normalizeLanguage(document.documentElement.getAttribute('lang'));
            if (lang) {
                return lang;
            }
        }

        return '';
    }

    function applyPopupContent(popupId, payload) {
        const popupEl = document.getElementById('mlp-popup-' + popupId);
        if (!popupEl || !payload) {
            return;
        }

        if (typeof payload.content === 'string') {
            const contentEl = popupEl.querySelector('.mlp-popup-inner .mlp-popup-content');
            if (contentEl) {
                contentEl.innerHTML = payload.content;
            }
        }

        if (typeof payload.buttonLabel === 'string') {
            const buttonEl = popupEl.querySelector('.mlp-popup-inner .mlp-popup-button');
            if (buttonEl) {
                buttonEl.textContent = payload.buttonLabel;
            }
        }

        if (typeof payload.mobileContent === 'string') {
            const mobileContentEl = popupEl.querySelector('.mlp-popup-mobile .mlp-popup-content');
            if (mobileContentEl) {
                mobileContentEl.innerHTML = payload.mobileContent;
            }
        }

        if (typeof payload.mobileButtonLabel === 'string') {
            const mobileButtonEl = popupEl.querySelector('.mlp-popup-mobile .mlp-popup-button');
            if (mobileButtonEl) {
                mobileButtonEl.textContent = payload.mobileButtonLabel;
            }
        }
    }

    function fetchPopupContent(popupId) {
        if (!config.restContentUrl) {
            return;
        }

        const popupEl = document.getElementById('mlp-popup-' + popupId);
        if (!popupEl || popupEl.getAttribute('data-mlp-content-loaded') === '1') {
            return;
        }

        const lang = resolveLanguage();
        const url = config.restContentUrl + '?popupId=' + encodeURIComponent(popupId) + (lang ? '&lang=' + encodeURIComponent(lang) : '');

        fetch(url, {
                credentials: 'same-origin'
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(payload) {
                if (!payload || !payload.success) {
                    return;
                }
                applyPopupContent(popupId, payload);
                popupEl.setAttribute('data-mlp-content-loaded', '1');
            })
            .catch(function() {});
    }

    // Point d'entrée léger (track.php, WordPress en SHORTINIT), sans nonce : les pages restent en cache 7 jours.
    function sendLightTrackingEvent(eventType, popupId) {
        const body = 'popupId=' + encodeURIComponent(popupId) + '&event=' + encodeURIComponent(eventType === 'conversion' ? 'click' : eventType);
        const type = 'application/x-www-form-urlencoded';

        if (navigator.sendBeacon) {
            try {
                if (navigator.sendBeacon(config.trackUrl, new Blob([body], {
                        type: type
                    }))) {
                    return;
                }
            } catch (error) {
                // Fallback to fetch below.
            }
        }

        try {
            window.fetch(config.trackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': type
                },
                body: body,
                credentials: 'omit',
                keepalive: true,
            }).catch(function() {});
        } catch (error) {
            // ignore
        }
    }

    function sendTrackingEvent(eventType, popupId) {
        if (config.trackUrl) {
            sendLightTrackingEvent(eventType, popupId);
            return;
        }

        // Page HTML en cache d'avant track.php (pas de trackUrl) : ancienne route REST.
        if (!config.restUrl || !config.restNonce) {
            return;
        }

        const payload = JSON.stringify({
            popupId: popupId,
            event: eventType,
        });

        const url = appendNonce(config.restUrl, config.restNonce);

        if (navigator.sendBeacon) {
            try {
                const blob = new Blob([payload], {
                    type: 'application/json'
                });
                if (navigator.sendBeacon(url, blob)) {
                    return;
                }
            } catch (error) {
                // Fallback to fetch below.
            }
        }

        try {
            window.fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': config.restNonce,
                },
                body: payload,
                credentials: 'same-origin',
                keepalive: true,
            }).catch(function() {});
        } catch (error) {
            // ignore
        }
    }

    function emitClickAnalytics(popupId, url) {
        try {
            const event = new CustomEvent('popup_clic', {
                detail: {
                    id: popupId,
                    url: url,
                },
            });

            document.dispatchEvent(event);
        } catch (error) {
            // ignore
        }

        if (typeof window !== 'undefined') {
            if (!Array.isArray(window.dataLayer)) {
                window.dataLayer = [];
            }

            if (Array.isArray(window.dataLayer)) {
                window.dataLayer.push({
                    event: 'popup clic',
                    popupId: popupId,
                    popupUrl: url,
                });
            }
        }
    }

    function focusElement(node) {
        if (!node || typeof node.focus !== 'function') {
            return;
        }

        try {
            node.focus({
                preventScroll: true
            });
        } catch (error) {
            node.focus();
        }
    }

    function setupGlobalHandlers(popup) {
        container.addEventListener('click', function(event) {
            const close = event.target.closest('[data-popup-close]');
            if (close) {
                event.preventDefault();
                popup.hide(true);
                return;
            }

            const button = event.target.closest('[data-popup-button]');
            if (!button) {
                return;
            }

            const popupId = parseInt(button.getAttribute('data-popup-button'), 10);
            if (popupId !== popup.id) {
                return;
            }

            const href = button.getAttribute('href') || '';
            emitClickAnalytics(popupId, href);
            sendTrackingEvent('conversion', popupId);
        });
    }

    function PopupInstance(element, popup) {
        this.id = popup.id;
        this.element = element;
        this.popup = popup;
        this.layout = element.getAttribute('data-layout') || 'modal_center';
        this.mobileOverride = element.getAttribute('data-mobile-override') === '1';
        this.trigger = popup.triggers && popup.triggers[device] ? popup.triggers[device] : {
            type: 'always',
            delayMs: 1000
        };
        this.scrollPercent = popup.triggers && typeof popup.triggers.scrollPercent === 'number' ? popup.triggers.scrollPercent : 5;
        this.visible = false;
        this.dismissed = isCapped(popup);
        if (!this.dismissed && dismissedRegistry[this.id]) {
            this.dismissed = true;
        }
        this.hasTrackedView = false;
        this.loadTimer = null;
        this.scrollCleanup = null;
        this.exitCleanup = null;
        this.keyHandler = null;
        this.focusHandler = null;
        this.previousFocus = null;
        this.focusable = [];
        this.bannerResize = null;
        this.bannerImageListeners = [];
    }

    PopupInstance.prototype.getActivePanel = function() {
        if (this.mobileOverride && device === 'mobile') {
            const mobile = this.element.querySelector('.mlp-popup-mobile');
            if (mobile) {
                return mobile;
            }
        }

        return this.element.querySelector('.mlp-popup-inner');
    };

    PopupInstance.prototype.activateBanner = function() {
        if (this.layout !== 'banner_top' && this.layout !== 'banner_bottom') {
            return;
        }

        const self = this;
        const updateOffsets = function() {
            if (self.layout === 'banner_top') {
                const panel = self.getActivePanel();
                const rect = panel && typeof panel.getBoundingClientRect === 'function' ? panel.getBoundingClientRect() : null;
                const height = rect && rect.height ? rect.height : 0;
                const admin = getAdminBarHeight();

                if (root) {
                    root.style.setProperty('--mlp-banner-top-offset', Math.max(0, Math.round(height)) + 'px');
                    root.style.setProperty('--mlp-banner-admin-offset', admin > 0 ? admin + 'px' : '0px');
                }
            }
        };

        if (this.layout === 'banner_top') {
            if (body) {
                body.classList.add('mlp-banner-top-active');
            }

            updateOffsets();
            window.requestAnimationFrame(updateOffsets);
            window.setTimeout(updateOffsets, 50);
            window.setTimeout(updateOffsets, 200);

            this.bannerResize = throttleFrame(updateOffsets);
            window.addEventListener('resize', this.bannerResize);
            window.addEventListener('orientationchange', this.bannerResize);

            const panel = this.getActivePanel();
            this.bannerImageListeners = [];

            if (panel) {
                const images = panel.querySelectorAll('img');

                for (let i = 0; i < images.length; i++) {
                    const image = images[i];

                    if (image.complete) {
                        continue;
                    }

                    image.addEventListener('load', this.bannerResize);
                    image.addEventListener('error', this.bannerResize);
                    this.bannerImageListeners.push(image);
                }
            }
        }
    };

    PopupInstance.prototype.deactivateBanner = function() {
        if (this.bannerImageListeners && this.bannerImageListeners.length) {
            for (let i = 0; i < this.bannerImageListeners.length; i++) {
                const image = this.bannerImageListeners[i];
                image.removeEventListener('load', this.bannerResize);
                image.removeEventListener('error', this.bannerResize);
            }
            this.bannerImageListeners = [];
        }

        if (this.bannerResize) {
            window.removeEventListener('resize', this.bannerResize);
            window.removeEventListener('orientationchange', this.bannerResize);
            this.bannerResize = null;
        }

        if (this.layout === 'banner_top') {
            if (body) {
                body.classList.remove('mlp-banner-top-active');
            }

            if (root) {
                root.style.removeProperty('--mlp-banner-top-offset');
                root.style.removeProperty('--mlp-banner-admin-offset');
            }
        }
    };

    PopupInstance.prototype.arm = function() {
        if (this.dismissed) {
            return;
        }

        const type = this.trigger && this.trigger.type ? this.trigger.type : 'always';

        if (type === 'always') {
            const delay = clampDelay(this.trigger.delayMs);
            this.loadTimer = window.setTimeout(this.requestShow.bind(this), delay);
        } else if (type === 'scroll') {
            this.armScroll();
        } else if (type === 'exit' && device === 'desktop') {
            this.armExitIntent();
        } else {
            const fallbackDelay = clampDelay(this.trigger.delayMs);
            this.loadTimer = window.setTimeout(this.requestShow.bind(this), fallbackDelay);
        }
    };

    PopupInstance.prototype.cleanupTriggers = function() {
        if (this.loadTimer) {
            window.clearTimeout(this.loadTimer);
            this.loadTimer = null;
        }

        if (typeof this.scrollCleanup === 'function') {
            this.scrollCleanup();
            this.scrollCleanup = null;
        }

        if (typeof this.exitCleanup === 'function') {
            this.exitCleanup();
            this.exitCleanup = null;
        }
    };

    PopupInstance.prototype.requestShow = function() {
        if (this.dismissed || this.visible) {
            return;
        }

        this.cleanupTriggers();
        this.show();
    };

    PopupInstance.prototype.show = function() {
        if (this.visible) {
            return;
        }

        this.visible = true;
        container.setAttribute('aria-hidden', 'false');
        this.element.classList.add('mlp-visible');
        this.element.setAttribute('aria-hidden', 'false');

        const isModal = this.layout === 'modal_center';

        if (body) {
            if (isModal) {
                body.classList.add('mlp-popup-open');
            } else {
                body.classList.remove('mlp-popup-open');
            }
        }

        if (this.layout === 'banner_top' || this.layout === 'banner_bottom') {
            this.activateBanner();
        }

        // Only a true modal traps focus. Banners are non-modal notifications,
        // so trapping would steal focus from the rest of the page (e.g. search).
        if (isModal) {
            this.trapFocus();
        }
        fetchPopupContent(this.id);

        if (!this.hasTrackedView) {
            this.hasTrackedView = true;

            if (this.popup.capping && (this.popup.capping.perSession || (this.popup.capping.perUserDays && parseInt(this.popup.capping.perUserDays, 10) > 0))) {
                rememberCap(this.popup);
                this.dismissed = true;
            }

            sendTrackingEvent('view', this.id);
        }
    };

    PopupInstance.prototype.hide = function(persist) {
        if (!this.visible) {
            return;
        }

        this.visible = false;
        this.cleanupTriggers();
        this.releaseFocus();
        this.deactivateBanner();

        this.element.classList.remove('mlp-visible');
        this.element.setAttribute('aria-hidden', 'true');
        container.setAttribute('aria-hidden', 'true');

        if (body) {
            body.classList.remove('mlp-popup-open');
        }

        if (persist !== false) {
            this.dismissed = true;
            dismissedRegistry[this.id] = true;
            rememberCap(this.popup);
        }
    };

    PopupInstance.prototype.armScroll = function() {
        const self = this;
        const threshold = typeof self.scrollPercent === 'number' ? self.scrollPercent : parseFloat(self.scrollPercent) || 5;
        let ticking = false;

        const check = function() {
            if (self.dismissed || self.visible) {
                if (typeof self.scrollCleanup === 'function') {
                    self.scrollCleanup();
                    self.scrollCleanup = null;
                }

                return;
            }

            const docEl = document.documentElement;
            const scrollTop = window.pageYOffset || docEl.scrollTop || 0;
            const scrollHeight = docEl.scrollHeight - window.innerHeight;
            const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 100;

            if (percent >= threshold) {
                if (typeof self.scrollCleanup === 'function') {
                    self.scrollCleanup();
                    self.scrollCleanup = null;
                }

                self.requestShow();
            }
        };

        const onScroll = function() {
            if (ticking) {
                return;
            }

            ticking = true;
            window.setTimeout(function() {
                ticking = false;
                check();
            }, 150);
        };

        window.addEventListener('scroll', onScroll, {
            passive: true
        });
        window.addEventListener('load', check, {
            once: true
        });

        this.scrollCleanup = function() {
            window.removeEventListener('scroll', onScroll);
        };

        check();
    };

    PopupInstance.prototype.armExitIntent = function() {
        const self = this;
        let triggered = false;
        let lastMove = 0;

        const shouldTrigger = function() {
            if (triggered || self.dismissed || self.visible) {
                return;
            }

            if (isMobileViewport()) {
                return;
            }

            if (!state.userInteracted) {
                return;
            }

            if (Date.now() - state.startTime < 2000) {
                return;
            }

            triggered = true;

            if (typeof self.exitCleanup === 'function') {
                self.exitCleanup();
                self.exitCleanup = null;
            }

            self.requestShow();
        };

        const onMouseMove = function(event) {
            if (event.clientY > 10 || event.movementY >= 0) {
                return;
            }

            const now = Date.now();
            if (now - lastMove < 350) {
                return;
            }

            lastMove = now;
            shouldTrigger();
        };

        const onMouseOut = function(event) {
            if (event.relatedTarget || event.toElement) {
                return;
            }

            if (event.clientY > 0) {
                return;
            }

            shouldTrigger();
        };

        document.addEventListener('mousemove', onMouseMove, {
            passive: true
        });
        document.addEventListener('mouseout', onMouseOut);

        this.exitCleanup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseout', onMouseOut);
        };
    };

    PopupInstance.prototype.trapFocus = function() {
        this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const selectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
        this.focusable = Array.prototype.slice.call(this.element.querySelectorAll(selectors)).filter(function(node) {
            return node && typeof node.focus === 'function' && !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true';
        });

        if (this.focusable.length === 0) {
            this.focusable = [this.element];
        }

        const first = this.focusable[0];

        window.requestAnimationFrame(function() {
            if (first) {
                focusElement(first);
            } else {
                focusElement(this.element);
            }
        }.bind(this));

        this.keyHandler = function(event) {
            if (event.key !== 'Tab') {
                return;
            }

            if (this.focusable.length === 0) {
                event.preventDefault();
                return;
            }

            const firstEl = this.focusable[0];
            const lastEl = this.focusable[this.focusable.length - 1];

            if (event.shiftKey && document.activeElement === firstEl) {
                event.preventDefault();
                lastEl.focus();
            } else if (!event.shiftKey && document.activeElement === lastEl) {
                event.preventDefault();
                firstEl.focus();
            }
        }.bind(this);

        this.focusHandler = function(event) {
            if (!this.visible) {
                return;
            }

            if (!this.element.contains(event.target)) {
                const target = this.focusable[0] || this.element;
                if (target && typeof target.focus === 'function') {
                    target.focus();
                }
            }
        }.bind(this);

        this.element.addEventListener('keydown', this.keyHandler);
        document.addEventListener('focusin', this.focusHandler);
    };

    PopupInstance.prototype.releaseFocus = function() {
        if (this.keyHandler) {
            this.element.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        if (this.focusHandler) {
            document.removeEventListener('focusin', this.focusHandler);
            this.focusHandler = null;
        }

        focusElement(this.previousFocus);

        this.previousFocus = null;
        this.focusable = [];
    };
})();

function matchesUrlConditions(conditions) {
    if (!conditions) {
        return true;
    }

    const mode = typeof conditions.urlMode === 'string' ? conditions.urlMode.toLowerCase() : 'all';
    const patterns = Array.isArray(conditions.urlPatterns) ? conditions.urlPatterns : [];

    if (mode === 'all' || !patterns.length) {
        return true;
    }

    const path = normalizeUrlPath(window.location.pathname || '/');
    let matched = false;

    for (let i = 0; i < patterns.length; i++) {
        const pattern = normalizeUrlPattern(patterns[i]);
        if (typeof pattern !== 'string' || !pattern.length) {
            continue;
        }

        const regex = wildcardToRegExp(pattern);
        if (regex.test(path)) {
            matched = true;
            break;
        }
    }

    if (mode === 'include') {
        return matched;
    }

    if (mode === 'exclude') {
        return !matched;
    }

    return true;
}

function normalizeUrlPath(path) {
    if (typeof path !== 'string') {
        return '/';
    }

    let normalized = path.trim();
    if (!normalized) {
        return '/';
    }

    if (normalized !== '/' && normalized.endsWith('/')) {
        normalized = normalized.replace(/\/+$/, '');
    }

    return normalized || '/';
}

function normalizeUrlPattern(pattern) {
    if (typeof pattern !== 'string') {
        return '';
    }

    let normalized = pattern.trim();
    if (!normalized) {
        return '';
    }

    if (normalized !== '/' && normalized.endsWith('/') && normalized.indexOf('*') === -1 && normalized.indexOf('?') === -1) {
        normalized = normalized.replace(/\/+$/, '');
    }

    return normalized;
}

function wildcardToRegExp(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const wildcard = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');

    return new RegExp('^' + wildcard + '$', 'i');
}