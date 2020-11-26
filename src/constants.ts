export const direnv = {
  name: 'direnv',
  cmd: 'direnv',
  rc: '.envrc'
}

export const vscode = {
  commands: {
    open: 'vscode.open',
    restart: 'workbench.action.reloadWindow'
  },
  extension: {
    actions: {
      allow: 'Allow',
      deny: 'Deny',
      revert: 'Revert',
      view: 'View',
      restart: 'Restart Editor'
    }
  }
}

export const messages = {
  error: (err: Error):string => `${direnv.name} error: ${err.message}`,
  version: (version: string):string => `${direnv.name} version: ${version}`,
  reverted: `${direnv.name}: You are now using the old environment.`,
  assign: {
    success: `${direnv.name}: Your ${direnv.rc} loaded successfully!`,
    warn: `${direnv.name}: Your ${direnv.rc} is blocked! You can view ${direnv.rc} or allow it directly.`,
    allow: `${direnv.name}: Would you like to allow this ${direnv.rc}?`
  },
  rc: {
    changed: `${direnv.name}: Your ${direnv.rc} has changed. Would you like to allow it?`,
    deleted: `${direnv.name}: You deleted the ${direnv.rc}. Would you like to revert to the old environment?`
  },
  denied: `${direnv.name}: Your ${direnv.rc} has been denied.`
}

export const workspaceState = {
  processEnvCache: 'processEnvCache'
}
