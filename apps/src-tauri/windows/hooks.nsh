; Xplorer NSIS Installer Hooks
; Registers "Open with Xplorer" context menu entries on install,
; and cleans up all registry entries on uninstall.

!macro NSIS_HOOK_POSTINSTALL
  ; Register "Open with Xplorer" context menu for folders
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenWithXplorer" "" "Open with Xplorer"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenWithXplorer" "Icon" "$INSTDIR\Xplorer.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenWithXplorer\command" "" '"$INSTDIR\Xplorer.exe" "%1"'

  ; Register for drives (C:\, D:\, etc.)
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenWithXplorer" "" "Open with Xplorer"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenWithXplorer" "Icon" "$INSTDIR\Xplorer.exe"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenWithXplorer\command" "" '"$INSTDIR\Xplorer.exe" "%1"'

  ; Register for folder background (right-click empty space inside folder)
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenWithXplorer" "" "Open with Xplorer"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenWithXplorer" "Icon" "$INSTDIR\Xplorer.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenWithXplorer\command" "" '"$INSTDIR\Xplorer.exe" "%V"'

  ; Notify Windows shell of association change
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x0000, p 0, p 0)'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Remove context menu entries
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenWithXplorer"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenWithXplorer"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenWithXplorer"

  ; If Xplorer was set as default handler, restore Windows Explorer
  ReadRegStr $0 HKCU "Software\Classes\Directory\shell" ""
  StrCmp $0 "OpenWithXplorer" 0 +2
    DeleteRegValue HKCU "Software\Classes\Directory\shell" ""

  ReadRegStr $0 HKCU "Software\Classes\Drive\shell" ""
  StrCmp $0 "OpenWithXplorer" 0 +2
    DeleteRegValue HKCU "Software\Classes\Drive\shell" ""

  ; Notify Windows shell of association change
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x0000, p 0, p 0)'
!macroend
