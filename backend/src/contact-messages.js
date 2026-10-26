const crypto = require("node:crypto");
const { AppError } = require("./errors");
const { mutateJson } = require("./storage");

const contactLimits = Object.freeze({
    name: 100,
    email: 254,
    subject: 200,
    message: 5000
});
const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContactInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new AppError(400, "VALIDATION_ERROR", "Contact data must be a JSON object.");
    }

    const values = {};
    const errors = {};
    for (const field of Object.keys(contactLimits)) {
        values[field] = typeof input[field] === "string" ? input[field].trim() : "";
        if (!values[field]) {
            errors[field] = field.charAt(0).toUpperCase() + field.slice(1) + " is required.";
        } else if (values[field].length > contactLimits[field]) {
            errors[field] = field.charAt(0).toUpperCase() + field.slice(1) +
                " must be " + contactLimits[field] + " characters or fewer.";
        }
    }

    if (values.email && values.email.length <= contactLimits.email && !basicEmailPattern.test(values.email)) {
        errors.email = "Enter a valid email address.";
    }

    if (Object.keys(errors).length) {
        throw new AppError(400, "VALIDATION_ERROR", "Contact message validation failed.", errors);
    }
    return values;
}

async function createContactMessage(input) {
    const values = validateContactInput(input);
    return mutateJson("contactMessages", function (messages) {
        const contactMessage = {
            id: crypto.randomUUID(),
            name: values.name,
            email: values.email,
            subject: values.subject,
            message: values.message,
            createdAt: new Date().toISOString()
        };
        return {
            value: messages.concat(contactMessage),
            result: contactMessage
        };
    });
}

module.exports = {
    contactLimits,
    createContactMessage,
    validateContactInput
};
