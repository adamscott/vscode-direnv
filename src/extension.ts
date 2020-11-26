import * as Performance from 'perf_hooks'

import { commands, ExtensionContext, Memento, OutputChannel, RelativePattern, Uri, window, workspace, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode'

import * as constants from './constants'
import { Command } from './command'
import { is } from 'typescript-is'

let outputChannel: OutputChannel
let commandEntries: Command[] = []
let oldEnvDiff: Record<string, string | undefined> = {}
let workspaceState: Memento

async function displayError (err: Error) {
  await window.showErrorMessage(constants.messages.error(err))
}

async function version () {
  const command = getEditorCommand()
  if (!command) {
    throw new Error('An internal error occured while trying to get direnv version.')
  }

  try {
    // Run `direnv version` command
    const version = await command.version()
    await window.showInformationMessage(constants.messages.version(version))
  } catch (err) {
    await displayError(err)
  }
}

async function revertFromOption (option: string | undefined) {
  if (!option) {
    return
  }

  if (option === constants.vscode.extension.actions.revert) {
    Object.assign(process.env, oldEnvDiff)
    oldEnvDiff = {}
    await window.showInformationMessage(constants.messages.reverted)
  }
}

async function assignEnvDiff (options: { showSuccess: boolean }) {
  const command = getEditorCommand()
  if (!command) {
    throw new Error('An internal error occured while trying to get direnv version.')
  }

  try {
    // Run `direnv export json` command
    const envDiff = await command.exportJson()

    Object.keys(envDiff).forEach((key) => {
      if (key.indexOf('DIRENV_') === -1 && oldEnvDiff[key] !== envDiff[key]) {
        oldEnvDiff[key] = process.env[key]
      }
    })

    outputChannel.appendLine(`before assign: ${Performance.performance.now()}`)
    Object.assign(process.env, envDiff)
    outputChannel.appendLine(`after assign: ${Performance.performance.now()}`)
  } catch (err) {
    await displayError(err)
    return
  }

  let option: string | undefined
  try {
    if (options.showSuccess) {
      option = await window.showInformationMessage(
        constants.messages.assign.success,
        constants.vscode.extension.actions.restart
      )
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.indexOf(`${constants.direnv.rc} is blocked`) !== -1) {
        option = await window.showWarningMessage(
          constants.messages.assign.warn,
          constants.vscode.extension.actions.allow,
          constants.vscode.extension.actions.view
        )
      } else {
        await displayError(err)
        return
      }
    } else {
      throw err
    }
  }

  try {
    switch (option) {
      case constants.vscode.extension.actions.allow:
        await allow()
        break
      case constants.vscode.extension.actions.deny:
        await deny()
        break
      case constants.vscode.extension.actions.view:
        await viewThenAllow()
        break
      case constants.vscode.extension.actions.restart:
        await restart(command)
        break
      default:
        // do nothing
    }
  } catch (err) {
    await displayError(err)
  }
}

async function allow () {
  console.log('allow()')

  console.log('break?')

  const command = getEditorCommand()
  if (!command) {
    throw new Error('An internal error occured while trying to allow directory.')
  }

  try {
    // Run `direnv allow` command
    await command.allow()
  } catch (err) {
    if (err instanceof Error) {
      try {
        if (err.message.indexOf(`${constants.direnv.rc} file not found`) !== -1) {
          const envrcUri = await getEnvrcUri(command)
          if (!envrcUri) {
            return
          }
          await commands.executeCommand(constants.vscode.commands.open, envrcUri)
        } else {
          await displayError(err)
          return
        }
      } catch (err) {
        await displayError(err)
        return
      }
    } else {
      throw err
    }
  }

  try {
    await assignEnvDiff({ showSuccess: true })
  } catch (err) {
    await displayError(err)
  }
}

async function allowFromOption (option: string | undefined) {
  if (!option) {
    return
  }

  try {
    if (option === constants.vscode.extension.actions.allow) {
      await allow()
    }
  } catch (err) {
    await displayError(err)
  }
}

async function deny () {
  const command = getEditorCommand()
  if (!command) {
    throw new Error('An internal error occured while trying to deny directory.')
  }

  try {
    // Run `direnv deny` command
    await command.deny()
  } catch (err) {
    await displayError(err)
    return
  }

  await revertFromOption(constants.vscode.extension.actions.revert)
}

async function view () {
  const command = getEditorCommand()
  if (!command) {
    throw new Error(`An internal error occured while trying to view ${constants.direnv.rc}`)
  }

  try {
    const envrcUri = await getEnvrcUri(command)
    if (!envrcUri) {
      return
    }
    await commands.executeCommand(constants.vscode.commands.open, envrcUri)
  } catch (err) {
    await displayError(err)
  }
}

async function viewThenAllow () {
  await view()
}

async function restart (command:Command) {
  await workspaceState.update(constants.workspaceState.processEnvCache, process.env)
  await commands.executeCommand(constants.vscode.commands.restart)
}

async function loadCache () {
  const processEnvCache = workspaceState.get<Record<string, string>>(constants.workspaceState.processEnvCache)
  if (processEnvCache) {
    process.env = processEnvCache
    await workspaceState.update(constants.workspaceState.processEnvCache, undefined)
  }
}

// async function onDidCreate (uri:Uri, workspaceFolder:WorkspaceFolder) {
//   const command = getCommandByWorkspaceFolder(workspaceFolder)
// }

async function onDidChange (uri:Uri, workspaceFolder:WorkspaceFolder) {
  const command = getCommandByWorkspaceFolder(workspaceFolder)

  const option = await window.showWarningMessage(constants.messages.rc.changed, constants.vscode.extension.actions.allow)
  await allowFromOption(option)
}

async function onDidDelete (uri:Uri, workspaceFolder:WorkspaceFolder) {
  const command = getCommandByWorkspaceFolder(workspaceFolder)

  const option = await window.showWarningMessage(constants.messages.rc.deleted, constants.vscode.extension.actions.revert)
  await revertFromOption(option)
}

function onDidChangeWorkspaceFolders (e: WorkspaceFoldersChangeEvent) {
  updateCommandEntries(e.added, e.removed)
}

function updateCommandEntries (added: readonly WorkspaceFolder[], removed: readonly WorkspaceFolder[]) {
  commandEntries = [
    ...commandEntries.filter((command) => {
      const workspaceFolder = removed.find((workspaceFolder) => workspaceFolder.uri === command.workspaceFolder.uri)

      if (!workspaceFolder) {
        return false
      }

      command.watcher.dispose()
      return true
    }),
    ...added.map((workspaceFolder) => {
      const relativePattern = new RelativePattern(workspaceFolder, `/${constants.direnv.rc}`)
      const watcher = workspace.createFileSystemWatcher(relativePattern)
      // watcher.onDidCreate((uri) => onDidCreate(uri, workspaceFolder))
      watcher.onDidChange((uri) => onDidChange(uri, workspaceFolder))
      watcher.onDidDelete((uri) => onDidDelete(uri, workspaceFolder))

      return new Command(workspaceFolder, relativePattern, watcher)
    })
  ]
}

function initCommandEntries () {
  if (!workspace.workspaceFolders) {
    return
  }

  updateCommandEntries(workspace.workspaceFolders, [])
}

function getEditorCommand (): Command | null {
  const editor = window.activeTextEditor

  if (!editor || !commandEntries || !commandEntries.length) {
    return null
  }

  const resource = editor.document.uri
  if (resource.scheme === 'file') {
    const folder = workspace.getWorkspaceFolder(resource)
    if (folder) {
      const commandEntry = commandEntries.find((command) => command.workspaceFolder.uri === folder.uri)

      if (commandEntry) {
        return commandEntry
      }
    }
  }

  return null
}

function getCommandByWorkspaceFolder (workspaceFolder:WorkspaceFolder):Command | null {
  const command = commandEntries.find((command) => command.workspaceFolder === workspaceFolder)
  return command || null
}

async function getEnvrcUri (command:Command):Promise<Uri|undefined> {
  const [envrcUri] = await workspace.findFiles(command.envrcRelativePattern)
  return envrcUri
}

export async function activate (context: ExtensionContext):Promise<void> {
  console.log('vscode-direnv activate')
  outputChannel = window.createOutputChannel('direnv')
  outputChannel.appendLine(`activate: ${Performance.performance.now()}`)

  initCommandEntries()

  workspaceState = context.workspaceState
  await loadCache()

  workspace.onDidChangeWorkspaceFolders(onDidChangeWorkspaceFolders)

  context.subscriptions.push(commands.registerCommand('direnv.version', version))
  context.subscriptions.push(commands.registerCommand('direnv.view', view))
  context.subscriptions.push(commands.registerCommand('direnv.allow', allow))
  context.subscriptions.push(commands.registerCommand('direnv.restart', restart))

  await assignEnvDiff({ showSuccess: false })
}

export function deactivate ():void {
  // do nothing
}
