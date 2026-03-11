export { renderV3Frame } from './frame/templates.js';
export {
    showLoginView,
    showDashboardView,
    showCommandPalette,
    hideCommandPalette,
    showAgentPanel,
    hideAgentPanel,
    setActiveSection,
    setSidebarState,
    getSectionTitle,
} from './frame/shell.js';
export {
    setLogin2FAVisibility,
    setLoginFeedback,
    setLoginMode,
    setOperatorAuthLoginState,
    setLoginSubmittingState,
    resetLoginForm,
    focusLoginField,
} from './frame/login.js';
export { renderAdminChrome } from './frame/chrome.js';
