document.addEventListener("DOMContentLoaded", function() {
    setTimeout(function() {
        var section = document.getElementById('telemedicina');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }, 500);
});
