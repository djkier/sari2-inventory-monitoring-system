document.addEventListener("DOMContentLoaded", function () {
    const slides = document.querySelectorAll(".hero-slide");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let currentSlide = 0;

    if (slides.length < 2 || reduceMotion) {
        return;
    }

    window.setInterval(function () {
        slides[currentSlide].classList.remove("is-active");
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add("is-active");
    }, 6500);
});