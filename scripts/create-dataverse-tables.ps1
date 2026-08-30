# Creates the BOLO Dataverse tables and columns.
# Usage: pwsh scripts/create-dataverse-tables.ps1 -Token <bearer token>
param(
  [string]$OrgUrl = "https://orgeaedec13.crm9.dynamics.com",
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Prefix = "new"
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
    OwnershipType         = "UserOwned"
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
    Write-Host "  created table $schemaName"
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
    Write-Host "    + $schemaName"
  } catch {
    $msg = $_.ErrorDetails.Message
    if ($msg -match "already exists|duplicate") { Write-Host "    = $schemaName (exists)" }
    else { Write-Host "    ! $schemaName -> $msg" }
  }
}

$personTable  = "${Prefix}_personbolo"
$vehicleTable = "${Prefix}_vehiclebolo"

Write-Host "Creating tables..."
New-Table "${Prefix}_PersonBolo"  "Person BOLO"  "Person BOLOs"  "${Prefix}_Name"
New-Table "${Prefix}_VehicleBolo" "Vehicle BOLO" "Vehicle BOLOs" "${Prefix}_Name"

Start-Sleep -Seconds 5

$shared = @(
  @{ n = "BoloType";    d = "BOLO type";    len = 100 },
  @{ n = "BoloStatus";  d = "Status";       len = 50 },
  @{ n = "CaseNumber";  d = "Case number";  len = 100 },
  @{ n = "CaseDetails"; d = "Case details"; len = 8000 },
  @{ n = "City";        d = "City";         len = 100 },
  @{ n = "State";       d = "State";        len = 10 },
  @{ n = "PhotoUrl";    d = "Photo";        len = 1048576 },
  @{ n = "OwnerName";   d = "Submitted by"; len = 200 }
)

$personOnly = @(
  @{ n = "FirstName";  d = "First name";  len = 100 },
  @{ n = "MiddleName"; d = "Middle name"; len = 100 },
  @{ n = "LastName";   d = "Last name";   len = 100 },
  @{ n = "Aka";        d = "AKA";         len = 200 },
  @{ n = "Age";        d = "Age range";   len = 50 },
  @{ n = "Race";       d = "Race";        len = 500 },
  @{ n = "Height";     d = "Height";      len = 50 },
  @{ n = "HairColor";  d = "Hair color";  len = 50 },
  @{ n = "EyeColor";   d = "Eye color";   len = 50 }
)

$vehicleOnly = @(
  @{ n = "VehicleYear";  d = "Year";                len = 10 },
  @{ n = "VehicleMake";  d = "Make";                len = 100 },
  @{ n = "VehicleModel"; d = "Model";               len = 100 },
  @{ n = "VehicleColor"; d = "Color";               len = 50 },
  @{ n = "PlateNumber";  d = "Plate number";        len = 20 },
  @{ n = "PlateState";   d = "Plate issuing state"; len = 10 }
)

Write-Host "Person BOLO columns:"
foreach ($c in ($shared + $personOnly)) {
  New-TextColumn $personTable "${Prefix}_$($c.n)" $c.d $c.len
}

Write-Host "Vehicle BOLO columns:"
foreach ($c in ($shared + $vehicleOnly)) {
  New-TextColumn $vehicleTable "${Prefix}_$($c.n)" $c.d $c.len
}

Write-Host "Publishing customizations..."
Invoke-RestMethod -Method Post -Uri "$api/PublishAllXml" -Headers $headers `
  -Body "{}" -ContentType "application/json" -TimeoutSec 600 | Out-Null
Write-Host "Done."
