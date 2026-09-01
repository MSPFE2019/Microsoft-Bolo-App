# Adds the optional "Date of birth" column to the person BOLO table.
#
# The app ships a Date of birth field, which needs a real Dataverse column to
# store into. Run this once against an environment that was created before the
# field existed. It is safe to re-run: an existing column is left alone.
#
# Usage: pwsh scripts/provision-dateofbirth.ps1 -Token <bearer token>
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

$body = @{
  "@odata.type"     = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"
  SchemaName        = "new_DateOfBirth"
  DisplayName       = @{ LocalizedLabels = @(@{ Label = "Date of birth"; LanguageCode = 1033 }) }
  RequiredLevel     = @{ Value = "None" }
  AttributeType     = "DateTime"
  AttributeTypeName = @{ Value = "DateTimeType" }
  # DateOnly avoids the timezone shift a full timestamp would introduce, which
  # can otherwise move a birth date across a day boundary between users.
  Format            = "DateOnly"
  DateTimeBehavior  = @{ Value = "DateOnly" }
}

Write-Host "Adding new_DateOfBirth to new_personbolo..." -ForegroundColor Cyan
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
