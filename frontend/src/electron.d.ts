export {}

declare global {
  interface Window {
    electronAPI?: {
      windowMinimize: () => void
      windowMaximize: () => void
      windowClose: () => void
      appQuit: () => void
      retryStartup: () => void
      getAppVersion: () => Promise<string>
      checkForUpdates: () => Promise<any>
      downloadUpdate: () => Promise<any>
      cancelUpdate: () => Promise<boolean>
      installUpdate: () => Promise<void>
      onUpdateAvailable: (cb: (info: any) => void) => () => void
      onUpdateNotAvailable: (cb: () => void) => () => void
      onUpdateError: (cb: (err: string) => void) => () => void
      onDownloadProgress: (cb: (progress: any) => void) => () => void
      onUpdateDownloaded: (cb: () => void) => () => void
    }
    updateStatus?: (message: string, isError?: boolean, errorLog?: string) => void
  }
}
