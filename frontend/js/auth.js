// Public demo account names remain a convenience; credential validation is server-side.
const testAccounts = [
    { username: "owner", role: "Store Owner" },
    { username: "staff", role: "Store Staff" }
];

// Resolve from this script so redirects work from either HTML subfolder.
const authProjectUrl = new URL("../", document.currentScript.src);
const loginUrl = new URL("html/frontfacing/login.html", authProjectUrl).href;
const dashboardUrl = new URL("html/inventory/dashboard.html", authProjectUrl).href;

let currentIdentity = null;
let identityRequest = null;

function getCurrentUser(forceRefresh = false) {
    if (currentIdentity && !forceRefresh) return Promise.resolve(currentIdentity);
    if (identityRequest) return identityRequest;

    identityRequest = Sari2Api.request("/auth/me")
        .then(function (identity) {
            currentIdentity = identity;
            return identity;
        })
        .finally(function () {
            identityRequest = null;
        });
    return identityRequest;
}

async function requireSession(forceRefresh = false) {
    try {
        return await getCurrentUser(forceRefresh);
    } catch (error) {
        if (error && error.status === 401) {
            currentIdentity = null;
            window.location.replace(loginUrl);
            return null;
        }
        throw error;
    }
}

async function logout() {
    try {
        await Sari2Api.request("/auth/logout", { method: "POST" });
    } catch (error) {
        if (!error || error.status !== 401) throw error;
    }
    currentIdentity = null;
    window.location.replace(loginUrl);
    return true;
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
    const accountSelect = document.getElementById("test-account");
    testAccounts.forEach(function (account) {
        const option = document.createElement("option");
        option.value = account.username;
        option.textContent = account.role;
        accountSelect.appendChild(option);
    });

    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    const feedback = document.getElementById("login-feedback");
    const loginFields = document.getElementById("login-fields");
    const submitButton = document.getElementById("login-submit");
    const inputs = [usernameInput, passwordInput];

    accountSelect.addEventListener("change", function () {
        const account = testAccounts.find(function (user) { return user.username === accountSelect.value; });
        if (!account) return;
        usernameInput.value = account.username;
        passwordInput.value = "";
        passwordInput.focus();
        feedback.textContent = "";
        inputs.forEach(function (input) {
            input.removeAttribute("aria-invalid");
            document.getElementById(input.id + "-error").textContent = "";
        });
    });

    function validateLoginField(input) {
        const message = input.value.trim() ? "" : "Please enter your " + input.name + ".";
        document.getElementById(input.id + "-error").textContent = message;
        input.setAttribute("aria-invalid", message ? "true" : "false");
        return message === "";
    }

    const loginRequest = Sari2Api.createRequestGuard(function (isPending) {
        loginFields.disabled = isPending;
        submitButton.textContent = isPending ? "Logging in..." : "Login";
    });

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (loginRequest.isPending) return;
        feedback.textContent = "";
        let firstInvalidInput = null;
        inputs.forEach(function (input) {
            if (!validateLoginField(input) && !firstInvalidInput) {
                firstInvalidInput = input;
            }
        });
        if (firstInvalidInput) {
            firstInvalidInput.focus();
            return;
        }

        try {
            const identity = await loginRequest.run(function () {
                return Sari2Api.request("/auth/login", {
                    method: "POST",
                    body: {
                        username: usernameInput.value,
                        password: passwordInput.value
                    }
                });
            });
            currentIdentity = identity;
            passwordInput.value = "";
            window.location.assign(dashboardUrl);
        } catch (error) {
            feedback.textContent = error.message || "Unable to log in. Try again.";
            passwordInput.focus();
        }
    });

    inputs.forEach(function (input) {
        input.addEventListener("input", function () {
            feedback.textContent = "";
            if (input.hasAttribute("aria-invalid")) {
                validateLoginField(input);
            }
        });
    });
    loginFields.disabled = false;
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
    const allowedRoles = ["Store Owner", "Store Staff"];
    const signupFields = document.getElementById("signup-fields");
    const submitButton = document.getElementById("signup-submit");
    const feedback = document.getElementById("signup-feedback");
    const fields = Array.from(signupForm.querySelectorAll("input, select"));
    const nameInput = document.getElementById("signup-name");
    const usernameInput = document.getElementById("signup-username");
    const password = document.getElementById("signup-password");
    const confirmation = document.getElementById("signup-confirmation");
    const roleInput = document.getElementById("signup-role");
    const storeNameInput = document.getElementById("signup-store-name");
    const storeCodeGroup = document.getElementById("signup-store-code-group");
    const storeCodeInput = document.getElementById("signup-store-code");
    const fieldByServerName = {
        name: nameInput,
        username: usernameInput,
        password: password,
        confirmation: confirmation,
        role: roleInput,
        storeName: storeNameInput,
        storeCode: storeCodeInput
    };

    function setFeedback(message, type) {
        feedback.textContent = message;
        feedback.className = "signup-feedback" + (type ? " is-" + type : "");
    }

    function setFieldMessage(field, message) {
        document.getElementById(field.id + "-error").textContent = message;
        field.setAttribute("aria-invalid", message ? "true" : "false");
    }

    function updateRoleFields() {
        const isStaff = roleInput.value === "Store Staff";
        storeCodeGroup.hidden = !isStaff;
        storeCodeInput.disabled = !isStaff || signupFields.disabled;
        storeCodeInput.required = isStaff;
        if (!isStaff) {
            storeCodeInput.value = "";
            setFieldMessage(storeCodeInput, "");
        }
    }

    function validateSignupField(field) {
        if (field.disabled) {
            setFieldMessage(field, "");
            return true;
        }

        let message = "";
        if (!field.value.trim()) {
            message = "Please complete this field.";
        } else if (field.id === "signup-role" &&
            !allowedRoles.includes(field.value)) {
            message = "Please select Store Owner or Store Staff.";
        } else if (field === confirmation && field.value !== password.value) {
            message = "Passwords must match.";
        } else if (field === storeCodeInput && !/^\d{6}$/.test(field.value)) {
            message = "Store code must contain exactly six digits.";
        }
        setFieldMessage(field, message);
        return message === "";
    }

    function applyServerFieldErrors(details) {
        if (!details || typeof details !== "object") return null;
        let firstInvalidField = null;
        Object.keys(details).forEach(function (name) {
            const field = fieldByServerName[name];
            if (!field || field.disabled || typeof details[name] !== "string") return;
            setFieldMessage(field, details[name]);
            if (!firstInvalidField) firstInvalidField = field;
        });
        return firstInvalidField;
    }

    const signupRequest = Sari2Api.createRequestGuard(function (isPending) {
        signupFields.disabled = isPending;
        submitButton.textContent = isPending ? "Creating account..." : "Sign Up";
        if (!isPending) updateRoleFields();
    });

    signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (signupRequest.isPending) return;
        setFeedback("", "");

        let firstInvalidField = null;
        fields.forEach(function (field) {
            if (!validateSignupField(field) && !firstInvalidField) {
                firstInvalidField = field;
            }
        });
        if (firstInvalidField) {
            firstInvalidField.focus();
            return;
        }

        const payload = {
            name: nameInput.value,
            username: usernameInput.value,
            password: password.value,
            confirmation: confirmation.value,
            role: roleInput.value,
            storeName: storeNameInput.value
        };
        if (roleInput.value === "Store Staff") payload.storeCode = storeCodeInput.value;

        try {
            const result = await signupRequest.run(function () {
                return Sari2Api.request("/auth/register", {
                    method: "POST",
                    body: payload
                });
            });
            const storeCode = result.user.role === "Store Owner" ? result.store.code : "";
            signupForm.reset();
            fields.forEach(function (field) { setFieldMessage(field, ""); });
            updateRoleFields();
            setFeedback(
                storeCode
                    ? "Account created. Your store code is " + storeCode + ". Save it and share it with your Staff. You can now return to Login."
                    : "Account created. You can now return to Login.",
                "success"
            );
        } catch (error) {
            const firstServerField = applyServerFieldErrors(error.details);
            setFeedback(error.message || "Unable to create the account. Try again.", "error");
            if (firstServerField) firstServerField.focus();
        }
    });

    fields.forEach(function (field) {
        field.addEventListener("input", function () {
            setFeedback("", "");
            if (field.hasAttribute("aria-invalid")) {
                validateSignupField(field);
            }
            if (field === password && confirmation.hasAttribute("aria-invalid")) {
                validateSignupField(confirmation);
            }
        });
    });
    roleInput.addEventListener("change", updateRoleFields);
    signupFields.disabled = false;
    updateRoleFields();
}