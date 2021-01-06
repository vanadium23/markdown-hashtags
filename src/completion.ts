import * as vscode from 'vscode';
import { getTagTree } from "./parser";

// If so, provide appropriate completion items from the current workspace
export class HashtagCompletionItemProvider {
    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ) {
        const tagTree = await getTagTree(false);
        // const linePrefix = document.lineAt(position).text.substr(0, position.character);
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
