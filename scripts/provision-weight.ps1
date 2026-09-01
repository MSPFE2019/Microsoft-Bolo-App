# Adds the optional "Weight" column to the person BOLO table.
#
# The app ships a Weight field, which needs a real Dataverse column to store
# into. Run this once against an environment that was created before the field
# existed. It is safe to re-run: an existing column is left alone.
#
# Usage: pwsh scripts/provision-weight.ps1 -Token <bearer token>
param(
  [string]$OrgUrl = "https://orgeaedec13.crm9.dynamics.com",
  [Parameter(Mandatory = $true)][string]$Token
)

$ErrorActionPreference = "Stop"
$api = "$OrgUrl/api/data/v9.2"
$headers = @{
  Authorization      = "Bearer $Token"
  Accept             = "application/json"
  "OData-Version"    = "4.0"
  "OData-MaxVersion" = "4.0"
}

# Stored as text, matching Height, so the range labels the app offers can change
# without a schema migration.
$body = @{
  "@odata.type"     = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
  SchemaName        = "new_Weight"
  DisplayName       = @{ LocalizedLabels = @(@{ Label = "Weight"; LanguageCode = 1033 }) }
  RequiredLevel     = @{ Value = "None" }
  AttributeType     = "String"
  AttributeTypeName = @{ Value = "StringType" }
  MaxLength         = 100
  FormatName        = @{ Value = "Text" }
}

Write-Host "Adding new_Weight to new_personbolo..." -ForegroundColor Cyan
try {
  Invoke-RestMethod -Method Post -Headers $headers -TimeoutSec 180 -ContentType "application/json" `
    -Uri "$api/EntityDefinitions(LogicalName='new_personbolo')/Attributes" `
    -Body ($body | ConvertTo-Json -Depth 12) | Out-Null
  Write-Host "  created." -ForegroundColor Green
} catch {
  $msg = $_.ErrorDetails.Message
  if ($msg -match "already exists|duplicate") {
    Write-Host "  already exists - nothing to do." -ForegroundColor Yellow
    exit 0
  }
  throw
}

Write-Host "Publishing customizations..." -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri "$api/PublishAllXml" -Headers $headers `
  -Body "{}" -ContentType "application/json" -TimeoutSec 600 | Out-Null

Write-Host "Done. Reload the app to use the field." -ForegroundColor Cyan
