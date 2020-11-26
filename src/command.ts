import { exec, ExecOptions } from 'child_process'

import { is } from 'typescript-is'
import { FileSystemWatcher, RelativePattern, workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode'

import * as constants from './constants'

interface CommandExecOptions {
  cmd: string[];
  cwd?: boolean;
}

/**
 * Command class
 */
export class Command {
  public workspaceFolder: WorkspaceFolder;

  public workspaceConfiguration: WorkspaceConfiguration;

  public envrcRelativePattern: RelativePattern;

  public watcher: FileSystemWatcher;

  public constructor (workspaceFolder: WorkspaceFolder, envrcRelativePattern:RelativePattern, watcher: FileSystemWatcher) {
    this.workspaceFolder = workspaceFolder
    this.workspaceConfiguration = workspace.getConfiguration('launch', workspaceFolder.uri)
    this.envrcRelativePattern = envrcRelativePattern
    this.watcher = watcher
  }

  // Private methods
  private async exec (options: CommandExecOptions): Promise<string> {
    const direnvCmd = [constants.direnv.cmd, ...options.cmd].join(' ')
    const execOptions: ExecOptions = {}
    if (options.cwd == null || options.cwd) {
      execOptions.cwd = this.workspaceFolder.uri.fsPath
    }

    return new Promise((resolve, reject) => {
      exec(direnvCmd, execOptions, (err, stdout, stderr) => {
        if (err) {
          err.message = stderr
          reject(err)
        } else {
          resolve(stdout)
        }
      })
    })
  }

  // Public methods
  public async version ():Promise<string> {
    return this.exec({ cmd: ['version'] })
  }

  public async allow ():Promise<string> {
    return this.exec({ cmd: ['allow'] })
  }

  public async deny ():Promise<string> {
    return this.exec({ cmd: ['deny'] })
  }

  public async exportJson (): Promise<Record<string, string>> {
    const result = await this.exec({ cmd: ['export', 'json'] })

    let parsedJson = {}

    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(result)
      if (is<Record<string, string>>(parsed)) {
        parsedJson = parsed
      }
    }

    return parsedJson
  }

  public async isAllowed ():Promise<boolean> {
    const result = await this.exec({ cmd: ['status'] })

    return result.search(/^Found RC allowed true/) === 0
  }
}
