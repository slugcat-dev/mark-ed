export class MarkdownEditor {
	private textarea: HTMLTextAreaElement
	private preview: HTMLElement

	constructor(textareaId: string, previewId: string) {
		this.textarea = document.getElementById(textareaId) as HTMLTextAreaElement
		this.preview = document.getElementById(previewId) as HTMLElement

		this.textarea.addEventListener('input', () => this.updatePreview())
	}

	setContent(content: string): void {
		this.textarea.value = content

		this.updatePreview()
	}

	private updatePreview(): void {
		const markdownText = this.textarea.value

		this.preview.innerHTML = this.parseMarkdown(markdownText)
	}

	private parseMarkdown(text: string): string {
		return text
			.replace(/^# (.*$)/gim, '<h1>$1</h1>')
			.replace(/^## (.*$)/gim, '<h2>$1</h2>')
			.replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
			.replace(/\*(.*)\*/gim, '<i>$1</i>')
			.replace(/\n$/gim, '<br />')
	}
}
