$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$bitmap = [System.Drawing.Bitmap]::new(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)
$shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
$shape.AddArc(4, 4, 88, 88, 180, 90)
$shape.AddArc(164, 4, 88, 88, 270, 90)
$shape.AddArc(164, 164, 88, 88, 0, 90)
$shape.AddArc(4, 164, 88, 88, 90, 90)
$shape.CloseFigure()
$brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Point]::new(0, 0), [System.Drawing.Point]::new(256, 256), [System.Drawing.ColorTranslator]::FromHtml('#71869b'), [System.Drawing.ColorTranslator]::FromHtml('#4e657c'))
$graphics.FillPath($brush, $shape)
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 13)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
for ($angle = 0; $angle -lt 180; $angle += 60) {
    $radians = $angle * [Math]::PI / 180
    $offsetX = [single](70 * [Math]::Sin($radians))
    $offsetY = [single](70 * [Math]::Cos($radians))
    $graphics.DrawLine($pen, [single](128 - $offsetX), [single](128 - $offsetY), [single](128 + $offsetX), [single](128 + $offsetY))
}
$bitmap.Save((Join-Path $projectRoot 'build\appicon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$pen.Dispose(); $brush.Dispose(); $shape.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
