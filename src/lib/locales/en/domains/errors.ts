/**
 * Error copy (stable code + localized reason, theme.md §7.11 / §8.2).
 * The backend `platformMessage` always wins over these fallbacks.
 */

export default {
	generic: "Failed to load",
	network: "Network connection failed",
	forbidden: "No access permission",
	notFound: "Resource not found",
	technicalDetails: "Technical details",
	requestFailed: "Request failed",
	unexpected: "An unexpected error occurred",
	fallback: "The operation failed. Try again later.",
	networkDetail: "Network request failed: cannot reach the server. Check your connection and retry.",
	badRequest: "The request parameters were rejected (400).",
	unauthorized: "Your session expired. Sign in again.",
	forbiddenAction: "You do not have permission for this action (403).",
	notFoundDetail: "The resource does not exist or was deleted (404).",
	conflict: "The current state conflicts with this action (409). Refresh and retry.",
	tooManyRequests: "Too many requests (429). Try again later.",
	serverError: "Server error ({{status}}). Try again later.",
};
