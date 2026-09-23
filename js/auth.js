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
