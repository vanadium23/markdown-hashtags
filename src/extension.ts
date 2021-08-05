// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { HashtagCompletionItemProvider } from "./completion";
import { HashtagReferenceProvider } from "./definition";
import { getTagTree } from "./parser";
import { HashtagTree } from "./tree";



// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    // first hashtags parsing for workspace
    await getTagTree(true);
    const hashtagTree = new HashtagTree();

    vscode.window.registerTreeDataProvider('hashtagTree', hashtagTree);
    vscode.workspace.onDidChangeTextDocument(async (e: vscode.TextDocumentChangeEvent) => {
        await getTagTree(true, e.document.uri.fsPath);
        hashtagTree.refresh();
    });

    vscode.workspace.onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
        hashtagTree.refresh();
    });

    vscode.commands.registerCommand('markdown-hashtags.refreshTags', () => {
        hashtagTree.refresh();
    });

    context.subscriptions.push(
        vscode.languages.registerReferenceProvider('markdown', new HashtagReferenceProvider()),
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('markdown', new HashtagCompletionItemProvider(), '#')
    );
}

// this method is called when your extension is deactivated
export function deactivate() { }
