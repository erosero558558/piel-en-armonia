/**
 * Navigation UI engine (deferred-loaded).
 * Handles mobile menu and video modal interactions.
 */
(function () {
    'use strict';

    function init() {
        return window.PielNavigationEngine;
    }

    function toggleMobileMenu(forceClose) {
        const menu = document.getElementById('mobileMenu');
        if (!menu) {
            return;
        }

        if (forceClose === false) {
            menu.classList.remove('active');
            document.body.style.overflow = '';
            return;
        }

        menu.classList.toggle('active');
        document.body.style.overflow = menu.classList.contains('active')
            ? 'hidden'
            : '';
    }

    function startWebVideo() {
        const modal = document.getElementById('videoModal');
        if (!modal) {
            return;
        }
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeVideoModal() {
        const modal = document.getElementById('videoModal');
        if (!modal) {
            return;
        }
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    window.PielNavigationEngine = {
        init,
        toggleMobileMenu,
        startWebVideo,
        closeVideoModal,
    };
})();
