/**
 * Escape special HTML characters in a string.
 */
export function escapeHTML(str: string): string {
	return str
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}
