import * as vscode from 'vscode';
import { findDefinitions } from './parser';

export class HashtagReferenceProvider implements vscode.ReferenceProvider {
  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Location[]> {
    return findDefinitions(document, position);
  }
};
