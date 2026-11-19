param([string]$Atlas = 'D:/projects/dev/DarkTower/Unity/Game/Assets/Game/Textures/ItemsA.png')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$destination = Join-Path $PSScriptRoot '../public/assets/items'
New-Item -ItemType Directory -Force $destination | Out-Null
$names = @('gold-coin','mirror','candle','cobblestone','cow','pitchfork','golden-cup','chalice','gold-tooth','horseshoe','skull','helmet','bread','scroll','apple','crown','sword','potato-sack','spoon','plush-rat','ruby-ring','bucket','club','barrel','mushroom')
# Unity's sprite rectangles preserve the atlas's slightly offset grid; Y starts at the bottom.
$metadata = Get-Content -Raw ($Atlas + '.meta')
$rectangles = [regex]::Matches($metadata, 'name: Items_(\d+)\s+rect:\s+serializedVersion: \d+\s+x: (\d+)\s+y: (\d+)\s+width: (\d+)\s+height: (\d+)')
if ($rectangles.Count -ne 25) { throw 'Expected 25 Unity sprite rectangles.' }
$source = [System.Drawing.Bitmap]::new($Atlas)
try {
  foreach ($match in $rectangles) {
    $index = [int]$match.Groups[1].Value
    $x = [int]$match.Groups[2].Value; $w = [int]$match.Groups[4].Value
    $h = [int]$match.Groups[5].Value; $y = $source.Height - [int]$match.Groups[3].Value - $h
    $left=$w; $top=$h; $right=-1; $bottom=-1
    for ($dy=0; $dy -lt $h; $dy++) {
      for ($dx=0; $dx -lt $w; $dx++) {
        if ($source.GetPixel($x+$dx,$y+$dy).A -gt 0) {
          $left=[Math]::Min($left,$dx); $right=[Math]::Max($right,$dx)
          $top=[Math]::Min($top,$dy); $bottom=[Math]::Max($bottom,$dy)
        }
      }
    }
    $bounds=[System.Drawing.Rectangle]::new($x+$left,$y+$top,$right-$left+1,$bottom-$top+1)
    $scale=112.0/[Math]::Max($bounds.Width,$bounds.Height)
    $width=[int][Math]::Round($bounds.Width*$scale); $height=[int][Math]::Round($bounds.Height*$scale)
    $output=[System.Drawing.Bitmap]::new(128,128)
    $graphics=[System.Drawing.Graphics]::FromImage($output)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $target=[System.Drawing.Rectangle]::new([int][Math]::Floor((128-$width)/2),[int][Math]::Floor((128-$height)/2),$width,$height)
      $graphics.DrawImage($source,$target,$bounds,[System.Drawing.GraphicsUnit]::Pixel)
      $output.Save((Join-Path $destination ($names[$index]+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $output.Dispose() }
  }
} finally { $source.Dispose() }
Write-Output 'Extracted 25 centered 128x128 transparent PNGs.'
