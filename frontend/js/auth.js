const accountRoles = ["Store Owner", "Store Staff"];

const authProjectUrl = new URL("../", document.currentScript.src);
const loginUrl = new URL("html/frontfacing/login.html", authProjectUrl).href;
const dashboardUrl = new URL("html/inventory/dashboard.html", authProjectUrl).href;

function getCurrentUser() {
    const session = getSession();
    return session && accountRoles.includes(session.role) ? session : null;
}

function requireSession() {
    const user = getCurrentUser();
    if (!user) window.location.replace(loginUrl);
    return user;
}

async function logout() {
    await Sari2Api.request("auth/logout", { method: "POST" });
    if (!clearSession()) {
        throw new Error("Unable to clear the local login session.");
    }

    // Clear login fields before navigating back to the login page.
    const username = document.getElementById("login-username");
    const password = document.getElementById("login-password");
    const accountSelect = document.getElementById("test-account");

    if (username) username.value = "";
    if (password) password.value = "";
    if (accountSelect) accountSelect.value = "";

    window.location.replace(loginUrl);
    return true;
}

const loginForm = document.getElementById("login-form");

if (loginForm) {
    const accountSelect = document.getElementById("test-account");
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    const feedback = document.getElementById("login-feedback");

    // Remove any password left in a session created by an older build.
    getSession();

    // Start with a clean login form.
    usernameInput.value = "";
    passwordInput.value = "";
    accountSelect.value = "";
    feedback.textContent = "";

    const inputs = [usernameInput, passwordInput];

    accountRoles.forEach(function (role) {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        accountSelect.appendChild(option);
    });

    function clearFieldErrors() {
        inputs.forEach(function (input) {
            input.removeAttribute("aria-invalid");
            document.getElementById(input.id + "-error").textContent = "";
        });
    }

    accountSelect.addEventListener("change", function () {
        usernameInput.value = "";
        passwordInput.value = "";
        feedback.textContent = "";
        clearFieldErrors();
    });

    function validateLoginField(input) {
        const message = input.value.trim()
            ? ""
            : "Please enter your " + input.name + ".";

        document.getElementById(input.id + "-error").textContent = message;
        input.setAttribute("aria-invalid", message ? "true" : "false");
        return message === "";
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
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

        const selectedRole = accountSelect.value;
        if (!selectedRole) {
            feedback.textContent = "Please choose an account type.";
            accountSelect.focus();
            return;
        }

        let account;
        try {
            account = await Sari2Api.request("auth/login", {
                method: "POST",
                body: {
                    username: usernameInput.value,
                    password: passwordInput.value,
                    role: selectedRole
                }
            });
        } catch (error) {
            feedback.textContent = error.status === 401
                ? "Invalid username or password."
                : error.message;
            passwordInput.focus();
            return;
        }

        if (!saveSession(account)) {
            feedback.textContent =
                "Unable to save your login. Please allow browser storage and try again.";
            return;
        }

        passwordInput.value = "";
        window.location.assign(dashboardUrl);
    });

    inputs.forEach(function (input) {
        input.addEventListener("input", function () {
            feedback.textContent = "";

            if (input.hasAttribute("aria-invalid")) {
                validateLoginField(input);
            }
        });
    });

    document.getElementById("login-fields").disabled = false;
}

const signupForm = document.getElementById("signup-form");

if (signupForm) {
    const roleInput = document.getElementById("signup-role");
    const ownerFields = document.getElementById("owner-registration-fields");
    const staffFields = document.getElementById("staff-registration-fields");
    const storeNameInput = document.getElementById("signup-store-name");
    const storeIdentityInput = document.getElementById("signup-store-identity");
    const password = document.getElementById("signup-password");
    const confirmation = document.getElementById("signup-confirmation");
    const submitButton = signupForm.querySelector("button[type='submit']");
    const commonFields = [
        document.getElementById("signup-name"),
        document.getElementById("signup-username"),
        password,
        confirmation,
        roleInput
    ];
    let signupPending = false;

    function activeSignupFields() {
        const roleSpecificField = roleInput.value === "Store Owner"
            ? storeNameInput
            : roleInput.value === "Store Staff" ? storeIdentityInput : null;
        return roleSpecificField ? commonFields.concat(roleSpecificField) : commonFields;
    }

    function updateRoleFields() {
        const isOwner = roleInput.value === "Store Owner";
        const isStaff = roleInput.value === "Store Staff";
        ownerFields.hidden = !isOwner;
        staffFields.hidden = !isStaff;
        storeNameInput.required = isOwner;
        storeIdentityInput.required = isStaff;
        [storeNameInput, storeIdentityInput].forEach(function (field) {
            field.value = "";
            field.removeAttribute("aria-invalid");
            document.getElementById(field.id + "-error").textContent = "";
        });
    }

    function validateSignupField(field) {
        let message = "";

        if (!field.value.trim()) {
            message = "Please complete this field.";
        } else if (field === roleInput && !accountRoles.includes(field.value)) {
            message = "Please select Store Owner or Store Staff.";
        } else if (field === password && field.value.length < 8) {
            message = "Password must be at least 8 characters.";
        } else if (field === confirmation && field.value !== password.value) {
            message = "Passwords must match.";
        } else if (field === storeIdentityInput && !/^\d{6}$/.test(field.value)) {
            message = "Enter the six-digit Store Identity for the store you are joining.";
        }

        document.getElementById(field.id + "-error").textContent = message;
        field.setAttribute("aria-invalid", message ? "true" : "false");
        return message === "";
    }

    signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (signupPending) return;

        let firstInvalidField = null;

        activeSignupFields().forEach(function (field) {
            if (!validateSignupField(field) && !firstInvalidField) {
                firstInvalidField = field;
            }
        });

        if (firstInvalidField) {
            firstInvalidField.focus();
            return;
        }

        signupPending = true;
        submitButton.disabled = true;
        try {
            const result = await Sari2Api.request("auth/register", {
                method: "POST",
                body: {
                    name: document.getElementById("signup-name").value,
                    username: document.getElementById("signup-username").value,
                    password: password.value,
                    role: roleInput.value,
                    storeName: isOwnerRegistration() ? storeNameInput.value : undefined,
                    storeIdentity: isStaffRegistration() ? storeIdentityInput.value : undefined
                }
            });

            const successMessage = result.user.role === "Store Owner"
                ? "Account created. Your Store Identity is " + result.store.storeIdentity + ". Share it only with staff you authorize."
                : "Staff account created and linked to " + result.store.name + ".";
            window.alert(successMessage);
            signupForm.reset();
            updateRoleFields();
            activeSignupFields().forEach(function (field) {
                field.removeAttribute("aria-invalid");
            });
            window.location.assign(loginUrl);
        } catch (error) {
            window.alert(error.message);
        } finally {
            signupPending = false;
            submitButton.disabled = false;
        }
    });

    commonFields.concat([storeNameInput, storeIdentityInput]).forEach(function (field) {
        field.addEventListener("input", function () {
            if (field.hasAttribute("aria-invalid")) {
                validateSignupField(field);
            }

            if (field === password && confirmation.hasAttribute("aria-invalid")) {
                validateSignupField(confirmation);
            }
        });
    });

    function isOwnerRegistration() {
        return roleInput.value === "Store Owner";
    }

    function isStaffRegistration() {
        return roleInput.value === "Store Staff";
    }

    roleInput.addEventListener("change", updateRoleFields);
    updateRoleFields();
    document.getElementById("signup-fields").disabled = false;
}
