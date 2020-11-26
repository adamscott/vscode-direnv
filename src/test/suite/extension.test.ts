import { strict as assert } from 'assert'
import { suite, test, after } from 'mocha'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode'
// import * as myExtension from '../extension';

suite('Extension Test Suite', function () {
  after(async () => {
    await vscode.window.showInformationMessage('All tests done!')
  })

  test('Sample test', function () {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5))
    assert.strictEqual(-1, [1, 2, 3].indexOf(0))
  })
})
