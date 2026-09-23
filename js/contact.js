const contactForm = document.getElementById("contact-form");
const contactFields = document.getElementById("contact-fields");
const contactFeedback = document.getElementById("contact-feedback");
const inquiryInputs = Array.from(contactFields.querySelectorAll("input, textarea"));

function validateContactField(field) {
    let message = "";

    if (!field.value.trim()) {
        message = "Please enter your " + field.name + ".";
    } else if (field.type === "email" && field.validity.typeMismatch) {
        message = "Please enter a valid email address.";
    }

    document.getElementById(field.id + "-error").textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
    return message === "";
}