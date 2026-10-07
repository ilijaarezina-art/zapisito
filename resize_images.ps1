Add-Type -AssemblyName System.Drawing
$iconPath = "c:\Users\Ilija-BusLogic\.gemini\antigravity\scratch\zapisito\mobile\assets\google_play_icon.jpg"
$iconDest = "c:\Users\Ilija-BusLogic\.gemini\antigravity\scratch\zapisito\mobile\assets\google_play_icon_512.png"

$bmp = [System.Drawing.Bitmap]::FromFile($iconPath)
$newIcon = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($newIcon)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($bmp, 0, 0, 512, 512)
$bmp.Dispose()
$newIcon.Save($iconDest, [System.Drawing.Imaging.ImageFormat]::Png)
$newIcon.Dispose()
Write-Host "RESIZED_ICON_512"

$featPath = "c:\Users\Ilija-BusLogic\.gemini\antigravity\scratch\zapisito\mobile\assets\google_play_feature_graphic.jpg"
$featDest = "c:\Users\Ilija-BusLogic\.gemini\antigravity\scratch\zapisito\mobile\assets\google_play_feature_graphic_1024x500.png"

$bmpFeat = [System.Drawing.Bitmap]::FromFile($featPath)
$newFeat = New-Object System.Drawing.Bitmap 1024, 500
$gFeat = [System.Drawing.Graphics]::FromImage($newFeat)
$gFeat.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFeat.DrawImage($bmpFeat, 0, 0, 1024, 500)
$bmpFeat.Dispose()
$newFeat.Save($featDest, [System.Drawing.Imaging.ImageFormat]::Png)
$newFeat.Dispose()
Write-Host "RESIZED_FEATURE_1024x500"
