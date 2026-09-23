// Shared authenticated shell. Load after storage.js and auth.js.
function initializeApp() {
    const shell = document.getElementById("app-shell");
    shell.hidden = true;
    const user = requireSession();
    if (!user) {
        return null;
    }
    const settings = getSettings();
    // Owner settings change presentation, not the predefined authentication identity.
    document.getElementById("current-user-name").textContent =
        user.role === "Store Owner" && settings.ownerName.trim() ? settings.ownerName : user.name;
    document.getElementById("current-user-role").textContent = user.role;
    document.getElementById("store-name").textContent = settings.storeName;
    shell.hidden = false;
    return user;
}

document.getElementById("logout-button").addEventListener("click", function () {
    if (logout()) {
        document.getElementById("app-shell").hidden = true;
    } else {
        document.getElementById("app-feedback").textContent = "Unable to log out. Please allow browser storage and try again.";
    }
});