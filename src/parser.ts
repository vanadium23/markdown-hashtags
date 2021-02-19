import * as vscode from 'vscode';
import * as path from "path";
import { TextDecoder } from "util";

type TagTree = {
    [key: string]: vscode.Location[],
};

type NotesTree = {
    [key: string]: TagTree,
};

const hashtagRegexp = /(^|\s)(#[^\s!@#$%^&*()=+.\/,\[{\]};:'"?><]+)/gm;

// global state, I know
let tags: TagTree = {};
let notes: NotesTree = {};

const parseWorkspace = async () => {
    const markdownUris = await vscode.workspace.findFiles('**/*.md');

    const promises: Promise<void>[] = [];

    for (const file of markdownUris) {
        const hiddenFile = path.basename(file.path).startsWith(".");
        if (!hiddenFile) {
            promises.push(parseFile(file.path));
        }
    }

    await Promise.all(promises);
};

const parseFile = async (filePath: string) => {
    const uri = vscode.Uri.file(filePath);

    const buffer = await vscode.workspace.fs.readFile(uri);
    const content = new TextDecoder("utf-8").decode(buffer);
    notes[filePath] = content.split(/\r?\n/).reduce((acc: TagTree, line: string, index: number): TagTree => {
        const matches = line.matchAll(hashtagRegexp) || [];
        for (const match of matches) {
            const hashtag = match[2];
            const position = new vscode.Position(index, match.index || 0);
            const location = new vscode.Location(uri, position);
            if (acc[hashtag]) {
                acc[hashtag].push(location);
            } else {
                acc[hashtag] = [location];
            }
        };
        return acc;
    }, {});
};

const updateTagTree = async (filePath?: string) => {
    if (filePath) {
        await parseFile(filePath);
    } else {
        await parseWorkspace();
    }
    // dump
    tags = {};
    // calculate
    for (const [notePath, hashtags] of Object.entries(notes)) {
        for (const [hashtag, locations] of Object.entries(hashtags)) {
            if (tags[hashtag]) {
                tags[hashtag] = [...tags[hashtag], ...locations];
            } else {
                tags[hashtag] = locations;
            }
        }
    }
};

export const getTagTree = async (update: boolean, filePath?: string): Promise<TagTree> => {
    if (update) {
        await updateTagTree(filePath);
    }
    return Promise.resolve(tags);
};

export const findDefinitions = (document: vscode.TextDocument, position: vscode.Position): vscode.Location[] => {
    const range = document.getWordRangeAtPosition(position, hashtagRegexp);
    const hashtag = document.getText(range);
    return tags[hashtag] || [];
};
