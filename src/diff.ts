import { DiffResult } from './types'

// Still searching for an appropriate diffing method that works with DOM updates,
// here are my some of my attempts so far:

// ATTEMPT 2:
// Skip the lines that have not changed, then diff what remains.
// First tried to write some own weird diffing algorithm,
// then tried LCS diffing only the changed lines, but that produced weird results aswell.
export function diffLines(before: string[], after: string[]): DiffResult[] {
	const delta = after.length - before.length
	const len = Math.max(before.length, after.length)
	const diff: DiffResult[] = []

	if (delta === 0) {
		// No lines added or deleted, but changes might have been made
		for (let line = 0; line < len; line++) {
			if (before[line] !== after[line])
				diff.push({ index: line, type: 'changed', value: after[line] })
		}
	} else {
		// Lines were added or deleted
		let start = 0
		let end = len - 1

		while (start < len && before[start] === after[start])
			start++

		while (end > start && before[delta > 0 ? end - delta : end] === after[delta < 0 ? end + delta : end])
			end--

		for (let line = start; line < end; line++) {
			if (delta > 0) {
				// Lines were added
			} else {
				// Lines were deleted
			}
		}

		// I don't know how to continue from here in a way that makes sense...
	}

	return diff
}

// ATTEMPT 1:
//
// Creates a diff based on the algorithm Git uses.
// Had problems with consecutive lines with the same content when updating the DOM.
export function diffLinesLCS(before: string[], after: string[], offset: number = 0): DiffResult[] {
	const lcs = computeLCS(before, after)
	const additions: DiffResult[] = []
	const deletions: DiffResult[] = []
	let i = before.length
	let j = after.length

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
			i--
			j--
		} else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
			additions.push({ index: j - 1 + offset, type: 'added', value: after[j - 1] })

			j--
		} else {
			deletions.push({ index: i - 1 + offset, type: 'deleted', value: before[i - 1] })

			i--
		}
	}

	const diff: DiffResult[] = []

	while (additions.length || deletions.length) {
		const addition = additions.pop()
		const deletion = deletions.pop()

		if (addition && deletion && addition.index === deletion.index) {
			diff.push({ index: deletion.index, type: 'changed', value: addition.value });
		} else {
			if (addition)
				diff.push(addition)

			if (deletion)
				diff.push(deletion)
		}
	}

	return diff
}

// Calculate the longest common subsequence
// https://florian.github.io/diffing/
function computeLCS(before: string[], after: string[]): number[][] {
	const m = before.length
	const n = after.length
	const lcs: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0))

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (before[i - 1] === after[j - 1])
				lcs[i][j] = lcs[i - 1][j - 1] + 1
			else
				lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
		}
	}

	return lcs
}
