' Stock App Launcher
Dim WshShell, fso, appDir, batFile

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
batFile = appDir & "\run-server.bat"

' Check files exist
If Not fso.FileExists(appDir & "\node.exe") Then
    MsgBox "node.exe missing! Please re-download the app.", 16, "Stock App Error"
    WScript.Quit
End If

If Not fso.FileExists(appDir & "\server.js") Then
    MsgBox "server.js missing! Please re-download the app.", 16, "Stock App Error"
    WScript.Quit
End If

If Not fso.FileExists(batFile) Then
    MsgBox "run-server.bat missing! Please re-download the app.", 16, "Stock App Error"
    WScript.Quit
End If

' Run the batch file silently (window hidden = 0)
WshShell.Run "cmd /c """ & batFile & """", 0, False

' Wait for server to start
WScript.Sleep 5000

' Open browser
WshShell.Run "http://localhost:3000"
