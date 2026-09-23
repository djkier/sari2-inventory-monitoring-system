const expirationFilter = document.getElementById("expiration-filter");
const expirationPageSize = 10;
let expirationPage = 1;

function initializeExpirationFilterFromUrl() {
    const requested = new URLSearchParams(window.location.search).get("expirationStatus");
    const option = Array.from(expirationFilter.options).find(function (item) {
        return item.value && item.value.toLowerCase().replaceAll(" ", "-") === requested;
    });
    if (option) expirationFilter.value = option.value;
}


