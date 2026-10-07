Add-Type -AssemblyName System.Drawing
$src1 = "C:\Users\Ilija-BusLogic\.gemini\antigravity\brain\1e49cf06-6e95-4d93-8603-87acd89d0bee\screenshot_poslovi_1791372013246.jpg"
$src2 = "C:\Users\Ilija-BusLogic\.gemini\antigravity\brain\1e49cf06-6e95-4d93-8603-87acd89d0bee\screenshot_pdf_1791372033432.jpg"

$dest1 = "c:\Users\Ilija-BusLogic\.gemini\antigravity\scratch\zapisito\mobile\assets\screenshot_1.png"
$dest2 = "c:\Users\Ilija-BusLogic\.gemini\antigravity\scratch\zapisito\mobile\assets\screenshot_2.png"

$b1 = [System.Drawing.Bitmap]::FromFile($src1)
$nb1 = New-Object System.Drawing.Bitmap 1080, 1920
$g1 = [System.Drawing.Graphics]::FromImage($nb1)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.DrawImage($b1, 0, 0, 1080, 1920)
$b1.Dispose()
$nb1.Save($dest1, [System.Drawing.Imaging.ImageFormat]::Png)
$nb1.Dispose()

$b2 = [System.Drawing.Bitmap]::FromFile($src2)
$nb2 = New-Object System.Drawing.Bitmap 1080, 1920
$g2 = [System.Drawing.Graphics]::FromImage($nb2)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($b2, 0, 0, 1080, 1920)
$b2.Dispose()
$nb2.Save($dest2, [System.Drawing.Imaging.ImageFormat]::Png)
$nb2.Dispose()

Write-Host "SCREENSHOTS_SAVED_SUCCESS"
