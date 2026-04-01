// S17-15 dynamic-reviews support
const reviewContainers = document.querySelectorAll('.dynamic-reviews[data-service]');

reviewContainers.forEach(container => {
    console.log("Found dynamic reviews container for service:", container.dataset.service);
});
