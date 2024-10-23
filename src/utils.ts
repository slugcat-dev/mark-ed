export const isFirefox = /Firefox/i.test(navigator.userAgent)
export const isAndroid = /Android/i.test(navigator.userAgent)
export const isMac = /Mac/i.test(navigator.platform)
export const isIOS = isMac && 'ontouchstart' in window

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
