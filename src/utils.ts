const nav = typeof navigator !== 'undefined' ? navigator : { userAgent: '', vendor: '' }

export const isChrome = /Chrome/i.test(nav.userAgent)
export const isFirefox = /Firefox/i.test(nav.userAgent)
export const isAndroid = /Android/i.test(nav.userAgent)
export const isMac = /Apple/i.test(nav.vendor)
export const isIOS = isMac && /Mobile/i.test(nav.userAgent)

/**
 * Recursively merge default values into an object.
 */
export function defu<T>(obj: Partial<T> | undefined, defaults: T): T {
	if (obj === undefined)
		obj = {}

	for (const key in defaults) {
		if (key === '__proto__' || key === 'constructor')
			continue

		const value = obj[key]
		const defaultValue = defaults[key]

		if (value === undefined || value === null)
			obj[key] = defaultValue
		else if (isPlainObject(value) && isPlainObject(defaultValue))
			obj[key] = defu(value, defaultValue)
	}

	return obj as T
}

function isPlainObject(obj: any): boolean {
	return obj && typeof obj === 'object' && obj.constructor === Object
}
