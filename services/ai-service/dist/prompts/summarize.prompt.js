const TYPE_LABEL = {
    task: 'task description',
    comment_thread: 'comment thread',
    doc: 'document',
};
export function buildSummarizePrompt(input) {
    const label = TYPE_LABEL[input.type];
    return `Please summarize the following ${label}:\n\n${input.content}`;
}
//# sourceMappingURL=summarize.prompt.js.map