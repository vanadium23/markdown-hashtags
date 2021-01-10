import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getTagTree } from './parser';

export class HashtagTree implements vscode.TreeDataProvider<HashtagTreeItem | FileTreeItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<HashtagTreeItem | FileTreeItem | undefined | void> = new vscode.EventEmitter<HashtagTreeItem | FileTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<HashtagTreeItem | FileTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HashtagTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HashtagTreeItem): Thenable<HashtagTreeItem[] | FileTreeItem[]> {
        return getTagTree(false).then((tagTree) => {
            if (element) {
                const files = [];
                for (const file of tagTree[element.label]) {
                    files.push(new FileTreeItem(file.uri, [file], vscode.TreeItemCollapsibleState.None));
                }
                return files;
            };
            const tagItems = [];

            for (const [tag, files] of Object.entries(tagTree)) {
                tagItems.push(new HashtagTreeItem(tag, files, vscode.TreeItemCollapsibleState.Collapsed));
            }

            return tagItems.sort((a, b) => b.files.length - a.files.length);
        });
    }
}

export class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly uri: vscode.Uri,
        public readonly files: vscode.Location[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(uri, collapsibleState);
        const file = files[0];
        this.description = `${file.range.start.line + 1}:${file.range.start.character}`;
        this.command = {
            title: 'Open File',
            command: 'vscode.open',
            arguments: [
                this.uri,
                {
                    preview: true,
                    // fragile code
                    selection: file.range,
                },
            ],
        };
    }
}

export class HashtagTreeItem extends vscode.TreeItem {

    constructor(
        public readonly label: string,
        public readonly files: vscode.Location[],
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.description = `(${this.files.length})`;
        this.tooltip = `${this.label} (${this.files.length})`;
    }
}