import * as vscode from "vscode";
import { getTagTree, GetTagTreeReason, TagTree } from "./parser";
import { getAllPaths } from "./util.js";

export class HashtagCompletionItemProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ) {
    const text = document.lineAt(position).text.substring(0, position.character);
    const slashMatched = text
      .split("")
      .reverse()
      .join("")
      // #24 in addition to "/" also "." can be used as tag separator
      // .match(/^\/[^\s!@#$%^&*()=+.,\[{\]};:'"?><]+#(\s|$)/);
      .match(/^\/[^\s!@#$%^&*()=+,\[{\]};:'"?><]+#(\s|$)/);
    let hashtagPath: string | undefined;
    if (/(?<=(^|\s))#$/.test(text)) {
    } else if (slashMatched !== null) {
      hashtagPath = text.slice(text.length - slashMatched[0].trimEnd().length + 1);
      // hashtagPathWithSlash = hashtagPathWithSlash.slice(0, hashtagPathWithSlash.length - 1);
    } else {
      return [];
    }

    const tagTree = await getTagTree(GetTagTreeReason.justGet);
    const allPaths = await getAllPaths(tagTree, ["locations"]);

    const completions: vscode.CompletionItem[] = [];
    const tasks: Promise<void>[] = [];

    for (const path of allPaths) {
      tasks.push(
        (async () => {
          // TODO: #24 - evaluate how to use "." in autocompletition as well.
          let pathStr = path.join("/");
          pathStr = pathStr.replace(/child\//g, "");
          let insertText = pathStr;
          if (hashtagPath) {
            const lowerHashtagPath = hashtagPath.toLowerCase();
            const lowerPathStr = pathStr.toLowerCase();
            if (lowerHashtagPath !== lowerPathStr) {
              if (pathStr.length > hashtagPath.length) {
                if (lowerPathStr.includes(lowerHashtagPath)) {
                  insertText = pathStr.replace(hashtagPath, "");
                } else {
                  return;
                }
              } else {
                return;
                // if (lowerHashtagPath.includes(lowerPathStr)) {
                //   insertText = hashtagPath.replace(pathStr, "");
                // } else {
                //   return;
                // }
              }
            }
          }
          if (insertText === "/") {
            insertText = "";
          }
          const completionItem = new vscode.CompletionItem(pathStr, vscode.CompletionItemKind.Keyword);
          completionItem.insertText = insertText;
          completions.push(completionItem);
        })()
      );
    }
    await Promise.all(tasks);

    return completions;
  }
}
