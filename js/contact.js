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

contactForm.addEventListener("submit", function (event) {
    // This demonstration never sends or stores the entered information.
    event.preventDefault();
    contactFeedback.textContent = "";
    let firstInvalidField = null;

    inquiryInputs.forEach(function (field) {
        field.value = field.value.trim();
        if (!validateContactField(field) && !firstInvalidField) {
            firstInvalidField = field;
        }
    });

    if (firstInvalidField) {
        contactFeedback.textContent = "Please correct the indicated fields and try again.";
        firstInvalidField.focus();
        return;
    }

    window.alert("This contact form is for demonstration purposes only. No message has been sent.");
    contactForm.reset();
    inquiryInputs.forEach(function (field) {
        field.removeAttribute("aria-invalid");
    });
});