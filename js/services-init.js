(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            var section = document.getElementById('servicios');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
            }
        }, 500);
    });

})();
