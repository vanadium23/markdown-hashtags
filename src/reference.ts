import * as vscode from "vscode";
import { findReferences } from "./parser";

export class HashtagReferenceProvider implements vscode.ReferenceProvider {
  public async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null | undefined> {
    return await findReferences(document, position);
  }
}
