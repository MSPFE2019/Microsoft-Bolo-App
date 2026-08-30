# Provisions the Dataverse storage the customizable-fields feature needs:
#   1. The new_boloconfig table that holds the shared field configuration.
#   2. A real column for every custom field an admin has added in the app.
#
# Run this after an admin adds a custom field. Until the column exists the app
# marks the field "Pending" and skips it on save, so running this is what makes
# a new field go live.
#
# Usage: pwsh scripts/provision-custom-fields.ps1 -Token <bearer token>
param(
  [string]$OrgUrl = "https://orgeaedec13.crm9.dynamics.com",
  [Parameter(Mandatory = $true)][string]$Token,
  [switch]$SkipConfigTable
)

$ErrorActionPreference = "Stop"
$api = "$OrgUrl/api/data/v9.2"
$headers = @{
  Authorization      = "Bearer $Token"
  Accept             = "application/json"
  "OData-Version"    = "4.0"
  "OData-MaxVersion" = "4.0"
}

function Label($text) {
  @{ LocalizedLabels = @(@{ Label = $text; LanguageCode = 1033 }) }
}

function New-Table($schemaName, $display, $plural, $primaryField) {
  $body = @{
    "@odata.type"         = "Microsoft.Dynamics.CRM.EntityMetadata"
    SchemaName            = $schemaName
    DisplayName           = Label $display
    DisplayCollectionName = Label $plural
    OwnershipType         = "OrganizationOwned"
    HasActivities         = $false
    HasNotes              = $false
    IsActivity            = $false
    Attributes            = @(
      @{
        "@odata.type"     = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        SchemaName        = $primaryField
        DisplayName       = Label "Name"
        MaxLength         = 200
        RequiredLevel     = @{ Value = "ApplicationRequired" }
        IsPrimaryName     = $true
        AttributeType     = "String"
        AttributeTypeName = @{ Value = "StringType" }
      }
    )
  }
  try {
    Invoke-RestMethod -Method Post -Uri "$api/EntityDefinitions" -Headers $headers `
      -Body ($body | ConvertTo-Json -Depth 12) -ContentType "application/json" -TimeoutSec 180 | Out-Null
    Write-Host "  created table $schemaName" -ForegroundColor Green
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match "already exists|duplicate|Cannot create") { Write-Host "  table $schemaName already exists" }
    else { throw }
  }
}

function New-TextColumn($entity, $schemaName, $display, $maxLength = 200) {
  $body = @{
    "@odata.type"     = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
    SchemaName        = $schemaName
    DisplayName       = Label $display
    MaxLength         = $maxLength
    RequiredLevel     = @{ Value = "None" }
    AttributeType     = "String"
    AttributeTypeName = @{ Value = "StringType" }
  }
  if ($maxLength -gt 4000) {
    $body["@odata.type"] = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
    $body.AttributeType = "Memo"
    $body.AttributeTypeName = @{ Value = "MemoType" }
  }
  $uri = "$api/EntityDefinitions(LogicalName='$entity')/Attributes"
  try {
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers `
      -Body ($body | ConvertTo-Json -Depth 12) -ContentType "application/json" -TimeoutSec 180 | Out-Null
    Write-Host "    + $schemaName" -ForegroundColor Green
    return $true
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match "already exists|duplicate") { Write-Host "    = $schemaName (exists)"; return $true }
    Write-Host "    ! $schemaName -> $msg" -ForegroundColor Red
    return $false
  }
}

# ---------------------------------------------------------------------------
# 1. Config table
# ---------------------------------------------------------------------------
if (-not $SkipConfigTable) {
  Write-Host "Ensuring config table..." -ForegroundColor Cyan
  New-Table "new_BoloConfig" "BOLO Config" "BOLO Configs" "new_Name"

  # A newly created table must be published before columns can be added to it,
  # otherwise the attribute POST fails with an opaque 0x80040216.
  Write-Host "  publishing table..."
  Invoke-RestMethod -Method Post -Uri "$api/PublishAllXml" -Headers $headers `
    -Body "{}" -ContentType "application/json" -TimeoutSec 600 | Out-Null

  # The whole field config serializes into one memo column. It is a single
  # small document that is always read and written as a unit, so splitting it
  # into columns would buy nothing.
  New-TextColumn "new_boloconfig" "new_ConfigJson" "Config JSON" 100000 | Out-Null

  Invoke-RestMethod -Method Post -Uri "$api/PublishAllXml" -Headers $headers `
    -Body "{}" -ContentType "application/json" -TimeoutSec 600 | Out-Null
}

# ---------------------------------------------------------------------------
# 2. Custom field columns
# ---------------------------------------------------------------------------
Write-Host "`nReading field config from Dataverse..." -ForegroundColor Cyan

$configRow = $null
try {
  $resp = Invoke-RestMethod -Method Get -Headers $headers -TimeoutSec 120 `
    -Uri "$api/new_boloconfigs?`$select=new_configjson&`$top=1"
  $configRow = $resp.value | Select-Object -First 1
} catch {
  Write-Host "  could not read new_boloconfigs: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

if (-not $configRow -or -not $configRow.new_configjson) {
  Write-Host "  no saved field config yet - nothing to provision." -ForegroundColor Yellow
  Write-Host "`nDone. Add a custom field in the app, then re-run this script." -ForegroundColor Cyan
  exit 0
}

$config = $configRow.new_configjson | ConvertFrom-Json
$custom = @($config.fields | Where-Object { -not $_.builtin })

if ($custom.Count -eq 0) {
  Write-Host "  no custom fields defined." -ForegroundColor Yellow
  exit 0
}

Write-Host "  found $($custom.Count) custom field(s)."

# A custom field can be scoped to person, vehicle, or both, so each one may
# need a column on either table.
$tables = @{ person = "new_personbolo"; vehicle = "new_vehiclebolo" }
$changed = $false

foreach ($field in $custom) {
  $targets = if ($field.scope -eq "both") { @("person", "vehicle") } else { @($field.scope) }
  # Multiselect values are stored semicolon-delimited like new_race, so they
  # need room for every choice rather than a single value.
  $len = if ($field.type -eq "multiselect" -or $field.type -eq "textarea") { 4000 } else { 400 }

  Write-Host "`n  $($field.label) [$($field.key)] -> $($field.logicalName)"
  $ok = $true
  foreach ($target in $targets) {
    $entity = $tables[$target]
    $schema = ($field.logicalName -replace '^new_', 'new_')
    if (-not (New-TextColumn $entity $schema $field.label $len)) { $ok = $false }
  }
  if ($ok) { $changed = $true }
}

# ---------------------------------------------------------------------------
# 3. Publish and mark provisioned
# ---------------------------------------------------------------------------
if ($changed) {
  Write-Host "`nPublishing customizations..." -ForegroundColor Cyan
  Invoke-RestMethod -Method Post -Uri "$api/PublishAllXml" -Headers $headers `
    -Body "{}" -ContentType "application/json" -TimeoutSec 600 | Out-Null
  Write-Host "  published." -ForegroundColor Green

  # Flip provisioned=true so the app stops treating these as pending and
  # starts reading/writing their columns.
  foreach ($field in $custom) { $field | Add-Member -NotePropertyName provisioned -NotePropertyValue $true -Force }
  $json = $config | ConvertTo-Json -Depth 12 -Compress
  $id = $configRow.new_boloconfigid
  Invoke-RestMethod -Method Patch -Uri "$api/new_boloconfigs($id)" -Headers $headers `
    -Body (@{ new_configjson = $json } | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 120 | Out-Null
  Write-Host "  marked $($custom.Count) field(s) provisioned." -ForegroundColor Green
}

Write-Host "`nDone. Reload the app to use the new fields." -ForegroundColor Cyan
