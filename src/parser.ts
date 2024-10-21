import * as vscode from "vscode";
import * as path from "path";
import { TextDecoder } from "util";
import { getDeepProp, insertInEachElem, addToDeepArr, setDeepProp } from "./util.js";
import { InvaildParamError, InvaildSettingError } from "./errors.js";

export type TagInfo = {
  locations?: vscode.Location[];
  child?: TagTree;
};

export type TagTree = {
  [key: string]: TagInfo;
};

type NotesTree = {
  [key: string]: {
    tags: TagTree;
    paths: string[][];
  };
};

// `?<=` to except `(^|\s)#` it self
//
// The `[\s]?` is to require a hashtag (or nested hashtags) must followed by a whitespace character
// or at the end of the line, in order to avoid https://github.com/vanadium23/markdown-hashtags/issues/13.
// Do not forget to use `.trimEnd()` in the code.

// #24 in addition to "/" also "." can be used as tag separator
export const hashtagRegexp = /(?<=(^|\s)#)[^\s!@#$%^&*()=+,\[{\]};:'"?><]+[\s]?/g;

// use closure to avoid global state which cause
function _tagTree() {
  let _tagTree: TagTree = {};
  return {
    get: async (path?: string | string[]) => {
      if (path === undefined) {
        return _tagTree;
      } else if (typeof path === "string") {
        return _tagTree[path];
      } else if (path?.constructor === Array) {
        return await getDeepProp(_tagTree, path);
      }
    },
    set: async (tagTree: TagTree) => {
      _tagTree = tagTree;
    },
    setProp: async (path: string | string[], value: any, autoCreate: boolean = true) => {
      if (typeof path === "string") {
        _tagTree[path] = value;
      } else if (path?.constructor === Array) {
        await setDeepProp(_tagTree, path, value, autoCreate);
      }
    },
  };
}

function _notes() {
  let _notes: NotesTree = {};
  return {
    get: async (path?: string | string[]) => {
      if (path === undefined) {
        return _notes;
      } else if (typeof path === "string") {
        return _notes[path];
      } else if (path?.constructor === Array) {
        return await getDeepProp(_notes, path);
      }
    },
    set: async (notes: NotesTree) => {
      _notes = notes;
    },
    setProp: async (path: string | string[], value: any, autoCreate: boolean = true) => {
      if (typeof path === "string") {
        _notes[path] = value;
      } else if (path?.constructor === Array) {
        await setDeepProp(_notes, path, value, autoCreate);
      }
    },
    deleteProp: async (key: keyof NotesTree) => {
      // TODO: deep delete prop
      delete _notes[key];
    },
  };
}

let tagTree = _tagTree();
let notes = _notes();

async function parseWorkspace() {
  await notes.set({});
  await tagTree.set({});

  const exts = vscode.workspace.getConfiguration("markdown-hashtags").get("file_extensions") as any[];
  let markdownUris: vscode.Uri[] = [];
  for (const ext of exts) {
    if (typeof ext !== "string") {
      throw new InvaildSettingError(`Wrong type of the value (${ext}), which must be string.`);
    } else if (!(ext as string).startsWith(".")) {
      throw new InvaildSettingError(`A file extension should start with dot, like ".md".`);
    } else {
      markdownUris = markdownUris.concat(await vscode.workspace.findFiles(`**/*${ext}`));
    }
  }

  if (markdownUris === []) {
    return;
  }
  const promises: Promise<void>[] = [];

  for (const file of markdownUris) {
    const hiddenFile = path.basename(file.path).startsWith(".");
    if (!hiddenFile) {
      promises.push(parseFile(file.fsPath, false));
    }
  }

  await Promise.all(promises);
}

async function parseFile(filePath: string, needCheckExts: boolean = true) {
  if (needCheckExts) {
    const exts = vscode.workspace.getConfiguration("markdown-hashtags").get("file_extensions") as any[];
    let isEistExt: boolean = false;
    for (const ext of exts) {
      if (typeof ext !== "string") {
        throw new InvaildSettingError(`Wrong type of the value (${ext}), which must be string.`);
      } else if (!(ext as string).startsWith(".")) {
        throw new InvaildSettingError(`A file extension should start with dot, like ".md".`);
      } else if (path.basename(filePath).endsWith(ext)) {
        isEistExt = true;
        break;
      }
    }
  }

  const uri = vscode.Uri.file(filePath);
  const buffer = await vscode.workspace.fs.readFile(uri);
  let content = new TextDecoder("utf-8").decode(buffer);

  const note: { tags: TagTree; paths: string[][] } = { tags: {}, paths: [] };
  let isInCodeBlock = false;
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (line.startsWith("```")) {
      isInCodeBlock = !isInCodeBlock;
    }
    if (isInCodeBlock) {
      continue;
    }

    const matches = line.matchAll(hashtagRegexp) || [];
    for (const match of matches) {
      const hashtag = match[0].trimEnd();
      const position = new vscode.Position(index, match.index || 0);
      const location = new vscode.Location(uri, position);

      // #24 in addition to "/" also "." can be used as tag separator
      // https://www.javascripttutorial.net/javascript-string-split/
      // The following example uses the split() method to split sentences in a paragraph into sentences:
      // let paragraph = 'Good Morning! How are you? This is John. John is my friend.';
      // let sentences = paragraph.split(/[!,?,.]/);
      // console.log(sentences);

      // https://www.javascripttutorial.net/javascript-regular-expression/
      // To create a regular expression in JavaScript, you enclose its pattern in forward-slash characters (/) like this:
      // let re = /hi/;

      // const splitedTags = hashtag.split("/");
      const splitedTags = hashtag.split(/[\/\.]/);
      await insertInEachElem(splitedTags, "child");
      const path = splitedTags.concat(["locations"]);
      const res = await getDeepProp(note.tags, path);
      if (res) {
        await addToDeepArr(note.tags, path, location);
      } else {
        await setDeepProp(note.tags, path, [location]);
      }
      note.paths.push(path);
    }
  }
  await notes.setProp(filePath, note);
}

export enum GetTagTreeReason {
  forFileCreatedOrUpdated,
  forFileDeleted,
  forFileRenamed,
  forWorkspace,
  justGet,
}

async function createOrUpdateTagTree(reason: GetTagTreeReason, filePaths?: string[], oldFilePaths?: string[]) {
  const tasks: Promise<void>[] = [];
  switch (reason) {
    case GetTagTreeReason.forFileCreatedOrUpdated:
      for (const path of filePaths!) {
        tasks.push(parseFile(path));
      }
      break;
    case GetTagTreeReason.forFileDeleted:
      for (const path of filePaths!) {
        tasks.push(notes.deleteProp(path));
      }
      break;
    case GetTagTreeReason.forFileRenamed:
      for (const path of oldFilePaths!) {
        tasks.push(notes.deleteProp(path));
      }
      for (const path of filePaths!) {
        tasks.push(parseFile(path));
      }
      break;
    case GetTagTreeReason.forWorkspace:
      await parseWorkspace();
      break;
    default:
      return;
  }
  if (tasks !== []) {
    await Promise.all(tasks);
  }

  let tmpTagTree = {};
  const tmpNotes: NotesTree = await notes.get();
  for (const value of Object.values(tmpNotes)) {
    for (const path of value.paths) {
      const tag = await getDeepProp(value.tags, path);
      if (tag) {
        (await getDeepProp(tmpTagTree, path))
          ? await addToDeepArr(tmpTagTree, path, tag, "concat")
          : await setDeepProp(tmpTagTree, path, tag);
      }
    }
  }
  await tagTree.set(tmpTagTree);
}

export async function getTagTree(
  reason: GetTagTreeReason,
  filePaths?: string[],
  oldFilePaths?: string[]
): Promise<TagTree> {
  switch (reason) {
    case GetTagTreeReason.forFileCreatedOrUpdated:
      if (filePaths === undefined) {
        throw new InvaildParamError(`The filePaths must be provided if the reason is forFileCreatedOrUpdated!`);
      }
      await createOrUpdateTagTree(reason, filePaths);
      break;
    case GetTagTreeReason.forFileRenamed:
      if (filePaths === undefined) {
        throw new InvaildParamError(`The filePaths and oldFilePaths must be provided if the reason is forFileRenamed!`);
      }
      await createOrUpdateTagTree(reason, filePaths, oldFilePaths);
      break;
    case GetTagTreeReason.forFileDeleted:
      if (filePaths === undefined) {
        throw new InvaildParamError(`The filePaths must be provided if the reason is forFileDeleted!`);
      }
      await createOrUpdateTagTree(reason, filePaths);
      break;
    case GetTagTreeReason.forWorkspace:
      await createOrUpdateTagTree(reason);
      break;
    case GetTagTreeReason.justGet:
      break;
  }

  return await tagTree.get();
}

export async function findReferences(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Location[]> {
  const range = document.getWordRangeAtPosition(position, hashtagRegexp);
  const hashtag = document.getText(range);
  if (hashtag) {
    const splitedTags = hashtag.trimEnd().split("/");
    await insertInEachElem(splitedTags, "child");
    const path = splitedTags.concat(["locations"]);
    const locations = await tagTree.get(path);
    return locations ?? [];
  } else {
    return [];
  }
}
