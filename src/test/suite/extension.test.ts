import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import { getTagTree } from '../../parser';

const testFolderLocation = '/../../../src/test/suite/'

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Test hashtag parsing regexp', async () => {
		const exampleFilePath = path.join(__dirname + testFolderLocation + 'example.md');
		const tags = await getTagTree(true, exampleFilePath);
		assert.deepStrictEqual(['#标签'], Object.keys(tags));
	});
});
