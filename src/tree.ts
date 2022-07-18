import * as vscode from "vscode";
import { getTagTree, GetTagTreeReason, TagInfo, TagTree } from "./parser";
import { countArrElems, countProps, deepCountArrElems, deepCountProps, getDeepProp, insertInEachElem } from "./util.js";

async function createTagItem(key: string, value: TagInfo, parentTagsPath?: string[]) {
  const countMode = vscode.workspace.getConfiguration("markdown-hashtags").get("sorting.mode") as string;
  if (value.child) {
    let filesCount =
      countMode === "plain"
        ? await countArrElems(value.child, "locations")
        : countMode === "deep"
        ? await deepCountArrElems(value.child, "locations")
        : 0;
    if (value.locations) {
      filesCount += value.locations.length;
    }
    const tagsCount =
      countMode === "plain"
        ? await countProps(value.child, ["child", "locations"])
        : countMode === "deep"
        ? await deepCountProps(value.child, ["child"], ["locations"])
        : 0;
    if (value.locations) {
      return new HashtagTreeItem(
        key,
        vscode.TreeItemCollapsibleState.Collapsed,
        parentTagsPath ?? [key],
        value.locations,
        { tags: tagsCount, files: filesCount },
        Object.keys(value.child)
      );
    }
    return new HashtagTreeItem(
      key,
      vscode.TreeItemCollapsibleState.Collapsed,
      parentTagsPath ?? [key],
      undefined,
      { tags: tagsCount, files: filesCount },
      Object.keys(value.child)
    );
  } else if (value.locations) {
    return new HashtagTreeItem(
      key,
      vscode.TreeItemCollapsibleState.Collapsed,
      parentTagsPath ?? [key],
      value.locations
    );
  }
}

type SortingFunctions = {
  [key: string]: (a: HashtagTreeItem | FileTreeItem, b: HashtagTreeItem | FileTreeItem) => number;
};

const sortingOptions: SortingFunctions = {
  countFiles: (a: HashtagTreeItem | FileTreeItem, b: HashtagTreeItem | FileTreeItem) => {
    if (a.files && b.files) {
      return a.files.length - b.files.length;
    } else if (a instanceof HashtagTreeItem && b instanceof HashtagTreeItem && a.counts && b.counts) {
      return a.counts.files! - b.counts.files!;
    } else {
      return 0;
    }
  },
  countTags: (a: HashtagTreeItem | FileTreeItem, b: HashtagTreeItem | FileTreeItem) => {
    if (a instanceof HashtagTreeItem && b instanceof HashtagTreeItem && a.counts && b.counts) {
      return a.counts.tags! - b.counts.tags!;
    } else {
      return 0;
    }
  },
  name: (a: HashtagTreeItem | FileTreeItem, b: HashtagTreeItem | FileTreeItem) => {
    return ("" + a.label).localeCompare("" + b.label);
  },
};

export class HashtagTree implements vscode.TreeDataProvider<HashtagTreeItem | FileTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<HashtagTreeItem | FileTreeItem | undefined | void> =
    new vscode.EventEmitter<HashtagTreeItem | FileTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<HashtagTreeItem | FileTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HashtagTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HashtagTreeItem): Promise<HashtagTreeItem[] | FileTreeItem[]> {
    const tagTree = await getTagTree(GetTagTreeReason.justGet);
    if (element) {
      let tagItems: HashtagTreeItem[] & FileTreeItem[] = [];
      if (element.files) {
        const tasks: Promise<any>[] = [];
        for (const file of element.files) {
          tasks.push(
            (async () => {
              tagItems.push(new FileTreeItem(file.uri, [file], vscode.TreeItemCollapsibleState.None));
            })()
          );
        }
        await Promise.all(tasks);
      }
      if (element.childTags && element.childTags.length > 0) {
        const tasks: Promise<any>[] = [];
        for (const tag of element.childTags) {
          tasks.push(
            (async () => {
              const path = element.parentTagsPath.concat([tag]);
              await insertInEachElem(path, "child");
              const tagInfo: TagInfo = await getDeepProp(tagTree, path);
              const parentTagsPath = element.parentTagsPath.concat(tag);
              const item = tagInfo ? await createTagItem(tag, tagInfo, parentTagsPath) : undefined;
              if (item) {
                tagItems.push(item);
              }
            })()
          );
        }
        await Promise.all(tasks);
      }

      return tagItems;
    }

    let tagItems: HashtagTreeItem[] = [];
    const tasks: Promise<any>[] = [];
    for (const [key, value] of Object.entries(tagTree)) {
      tasks.push(
        (async () => {
          const item = await createTagItem(key, value);
          if (item) {
            tagItems.push(item);
          }
        })()
      );
    }
    await Promise.all(tasks);

    const sortingKey = vscode.workspace.getConfiguration("markdown-hashtags").get("sorting.key") as string;
    const sortingOrder = vscode.workspace.getConfiguration("markdown-hashtags").get("sorting.order") as string;
    const sortingFunction = sortingOptions[sortingKey];
    let sign = 1;
    if (sortingOrder === "desc") {
      sign = -1;
    }
    return tagItems.sort((a, b) => sign * sortingFunction(a, b));
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly files: vscode.Location[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(uri, collapsibleState);
    let file = files[0];
    this.description = `${file.range.start.line + 1}:${file.range.start.character}`;
    this.command = {
      title: "Open File",
      command: "vscode.open",
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
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly parentTagsPath: string[],
    public readonly files?: vscode.Location[],
    public readonly counts?: { tags: number; files: number },
    public readonly childTags?: string[],
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    if (this.counts) {
      this.description = `(tags: ${this.counts.tags}, files: ${this.counts.files})`;
      this.tooltip = `${this.label} (tags: ${this.counts.tags}, files: ${this.counts.files})`;
    }
    if (this.description === undefined && this.files) {
      this.description = `(files: ${this.files.length})`;
      this.tooltip = `${this.label} (files: ${this.files.length})`;
    }
  }
}
