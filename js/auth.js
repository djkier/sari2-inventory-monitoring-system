// Phase 1 simulation only: these public test credentials are not real security.
const testAccounts = [
    { username: "owner", password: "owner123", name: "Juan Dela Cruz", role: "Store Owner" },
    { username: "staff", password: "staff123", name: "Maria Santos", role: "Store Staff" }
];

// Resolve from this script so redirects work from either HTML subfolder.
const authProjectUrl = new URL("../", document.currentScript.src);
const loginUrl = new URL("html/frontfacing/login.html", authProjectUrl).href;
const dashboardUrl = new URL("html/inventory/dashboard.html", authProjectUrl).href;

function getCurrentUser() {
    const session = getSession();
    if (!session) {
        return null;
    }
    const account = testAccounts.find(function (user) {
        return user.username === session.username && user.name === session.name && user.role === session.role;
    });
    return account ? session : null;
}

// Future inventory pages call this before rendering their protected content.
function requireSession() {
    const user = getCurrentUser();
    if (!user) {
        window.location.replace(loginUrl);
    }
    return user;
}

// Future Logout controls can display an inline error if this returns false.
function logout() {
    if (!clearSession()) {
        return false;
    }
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
    const inputs = [usernameInput, passwordInput];

    accountSelect.addEventListener("change", function () {
        const account = testAccounts.find(function (user) { return user.username === accountSelect.value; });
        if (!account) return;
        usernameInput.value = account.username;
        passwordInput.value = account.password;
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

    loginForm.addEventListener("submit", function (event) {
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

        const account = testAccounts.find(function (user) {
            return user.username === usernameInput.value.trim() && user.password === passwordInput.value;
        });
        if (!account) {
            feedback.textContent = "Invalid username or password.";
            passwordInput.focus();
            return;
        }
        if (!saveSession(account)) {
            feedback.textContent = "Unable to save your login. Please allow browser storage and try again.";
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