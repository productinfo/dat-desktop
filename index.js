'use strict'

const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron')
const { neutral } = require('dat-colors')
const autoUpdater = require('./lib/auto-updater')
const defaultMenu = require('electron-default-menu')
const doctor = require('dat-doctor')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development'
const { Writable } = require('stream')

const menu = defaultMenu(app, shell)
menu[menu.length - 1].submenu.push({
  label: 'Doctor',
  click: () => {
    win.webContents.openDevTools({ mode: 'detach' })
    const out = Writable({
      write (chunk, env, done) {
        if (win) win.webContents.send('log', chunk.toString())
        done()
      }
    })
    doctor({ out })
  }
})

let win
let watchProcess

app.on('ready', () => {
  if (isDev) {
    BrowserWindow.addDevToolsExtension(path.join(__dirname, 'dev', 'react-dev-tools'))
    watchAndReload()
  }
  win = new BrowserWindow({
    // Extending the size of the browserwindow to make sure that the developer bar is visible.
    width: 800 + (isDev ? 50 : 0),
    height: 600 + (isDev ? 200 : 0),
    titleBarStyle: 'hiddenInset',
    minWidth: 640,
    minHeight: 395,
    backgroundColor: neutral,
    webPreferences: {
      nodeIntegration: false,
      preload: `${__dirname}/preload.js`
    }
  })
  win.loadURL(`file://${__dirname}/index.html`)
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu))

  ipcMain.on('progress', (_, progress) => win && win.setProgressBar(progress))

  if (isDev) {
    win.webContents.openDevTools()
  } else {
    const log = str => win && win.webContents.send('log', str)
    autoUpdater({ log })
  }
})

app.on('will-finish-launching', () => {
  app.on('open-url', (_, url) => win.webContents.send('link', url))
  app.on('open-file', (_, path) => win.webContents.send('file', path))
})

app.on('window-all-closed', () => {
  if (watchProcess) {
    watchProcess.close()
    watchProcess = null
  }
  app.quit()
})

const quit = app.makeSingleInstance(() => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

if (quit) app.quit()

function watchAndReload () {
  let gaze
  let first = true
  try {
    gaze = require('gaze')
  } catch (e) {
    console.warn('Gaze is not installed, wont be able to reload the app')
    // In case dev dependencies are not installed
    return
  }
  gaze([
    `preload.js`,
    `static/**/*`
  ], {
    debounceDelay: 60,
    cwd: __dirname
  }, (err, process) => {
    if (err) {
      console.warn('Gaze doesnt run well, wont be able to reload the app')
      console.warn(err)
      return
    }
    watchProcess = process
    watchProcess.on('all', () => {
      if (first) {
        first = false
        return
      }
      win && win.reload()
    })
  })
}
