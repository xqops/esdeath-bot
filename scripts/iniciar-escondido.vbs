' Liga o bot sem abrir janela nenhuma (o manter-ligado.ps1 religa se ele cair).
Set fso = CreateObject("Scripting.FileSystemObject")
script = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "manter-ligado.ps1")
CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & script & """", 0, False
