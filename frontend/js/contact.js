const contactForm = document.getElementById("contact-form");
const contactFields = document.getElementById("contact-fields");
const contactFeedback = document.getElementById("contact-feedback");
const inquiryInputs = Array.from(contactFields.querySelectorAll("input, textarea"));
const contactRequest = window.Sari2Api.createRequestGuard(function (isPending) {
    contactFields.disabled = isPending;
});

function setContactFeedback(message, isError) {
    contactFeedback.textContent = message;
    contactFeedback.classList.toggle("is-error", Boolean(isError));
}

function validateContactField(field) {
    let message = "";

    if (!field.value.trim()) {
        message = "Please enter your " + field.name + ".";
    } else if (field.type === "email" && field.validity.typeMismatch) {
        message = "Please enter a valid email address.";
    } else if (field.validity.tooLong) {
        message = "Please shorten your " + field.name + ".";
    }

    document.getElementById(field.id + "-error").textContent = message;
    field.setAttribute("aria-invalid", message ? "true" : "false");
    return message === "";
}

function showServerFieldErrors(details) {
    if (!details || typeof details !== "object") return;
    inquiryInputs.forEach(function (field) {
        if (!details[field.name]) return;
        document.getElementById(field.id + "-error").textContent = details[field.name];
        field.setAttribute("aria-invalid", "true");
    });
}

contactForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (contactRequest.isPending) return;

    setContactFeedback("", false);
    let firstInvalidField = null;
    const payload = {};

    inquiryInputs.forEach(function (field) {
        field.value = field.value.trim();
        payload[field.name] = field.value;
        if (!validateContactField(field) && !firstInvalidField) firstInvalidField = field;
    });

    if (firstInvalidField) {
        setContactFeedback("Please correct the indicated fields and try again.", true);
        firstInvalidField.focus();
        return;
    }

    try {
        await contactRequest.run(function () {
            return window.Sari2Api.request("/contact", { method: "POST", body: payload });
        });
        contactForm.reset();
        inquiryInputs.forEach(function (field) {
            field.removeAttribute("aria-invalid");
            document.getElementById(field.id + "-error").textContent = "";
        });
        setContactFeedback("Your message was sent successfully. Thank you for contacting Sari2.", false);
    } catch (error) {
        showServerFieldErrors(error.details);
        setContactFeedback(error.message || "Unable to send your message. Please try again.", true);
    }
});

inquiryInputs.forEach(function (field) {
    field.addEventListener("input", function () {
        setContactFeedback("", false);
        if (field.hasAttribute("aria-invalid")) validateContactField(field);
    });
});

// Enable the form only after its API submission handler is ready.
contactFields.disabled = false;