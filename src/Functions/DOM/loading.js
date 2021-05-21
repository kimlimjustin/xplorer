const startLoading = () => {
    const LOADING_BAR = document.querySelector(".loading-bar")
    LOADING_BAR.dataset.loading = "true"
}

const stopLoading = () => {
    const LOADING_BAR = document.querySelector(".loading-bar")
    LOADING_BAR.dataset.loading = "false"
}

module.exports = { startLoading, stopLoading }