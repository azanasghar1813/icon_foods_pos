; Keep the same one-click install as 1.0.14/1.0.15.
; Only extra: close Restaurant POS.exe (name has a space, default check misses it)
; and always recreate shortcuts AFTER files are on disk.

!macro customCheckAppRunning
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "Restaurant POS.exe" /T'
  Pop $R8
  Sleep 1500
!macroend

!macro customInit
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "Restaurant POS.exe" /T'
  Pop $R8
  Sleep 800
!macroend

!macro customInstall
  IfFileExists "$INSTDIR\Restaurant POS.exe" 0 pos_skip_shortcuts
    CreateShortCut "$DESKTOP\Restaurant POS.lnk" "$INSTDIR\Restaurant POS.exe" "" "$INSTDIR\Restaurant POS.exe" 0
    CreateShortCut "$SMPROGRAMS\Restaurant POS.lnk" "$INSTDIR\Restaurant POS.exe" "" "$INSTDIR\Restaurant POS.exe" 0
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  pos_skip_shortcuts:
!macroend
