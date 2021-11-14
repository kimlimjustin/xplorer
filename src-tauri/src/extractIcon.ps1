Add-Type -AssemblyName System.Drawing

$filePath = $args[0];
$target = $args[1];
$fileExists = Test-Path -Path $filePath;

if ($fileExists -and $filePath.EndsWith(".lnk")) {
    Try {
        $sh = New-Object -ComObject WScript.Shell;
        $filePath = $sh.CreateShortcut($filePath).TargetPath;
    }
    Catch {
        <# do nothing #>
    }
}

if ($fileExists) {
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($filePath);
    $icon.ToBitmap().save($target, [System.Drawing.Imaging.ImageFormat]::Png); 
}
