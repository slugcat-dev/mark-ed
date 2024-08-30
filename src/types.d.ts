export interface EditorSelection {
	start: number
	end: number
}

export interface DiffResult {
	type: 'added' | 'changed' | 'deleted'
	index: number
	value: string
}
