import * as vscode from 'vscode';
import { getTagTree } from "./parser";

// If so, provide appropriate completion items from the current workspace
export class HashtagCompletionItemProvider {
    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ) {
        // https://github.com/vanadium23/markdown-hashtags/issues/13#issuecomment-886175972
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        if (/##$/.test(linePrefix)) {
            return [];
        }
        const tagTree = await getTagTree(false);
        const uniqueTags = Object.keys(tagTree);
        const completions = [];
        for (let index = 0; index < uniqueTags.length; index++) {
            completions.push(
                new vscode.CompletionItem(uniqueTags[index].replace('#', ''), vscode.CompletionItemKind.Keyword)
            );
        }

        return completions;
    }
};
