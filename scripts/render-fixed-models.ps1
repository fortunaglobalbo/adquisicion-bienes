param([string]$Workspace = (Split-Path -Parent $PSScriptRoot))
$root = [System.IO.Path]::GetFullPath($Workspace)
$output = Join-Path $root 'test-results/fixed-models/pdf'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    foreach ($model in Get-ChildItem -LiteralPath (Join-Path $root 'templates/ende') -Filter '*.docx') {
        $document = $null
        try {
            $document = $word.Documents.Open($model.FullName, $false, $true, $false)
            $target = Join-Path $output ($model.BaseName + '.pdf')
            $document.ExportAsFixedFormat($target, 17)
            Write-Output ($model.Name + ': PDF generado')
        } finally { if ($document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) } }
    }
} finally {
    if ($word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
}
