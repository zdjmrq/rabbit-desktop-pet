const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopPet', {
  setInteractiveRegions(regions, capture) {
    ipcRenderer.send('desktop-pet:set-interactive-regions', regions, Boolean(capture))
  },
  quit() {
    ipcRenderer.send('desktop-pet:quit')
  },
})
