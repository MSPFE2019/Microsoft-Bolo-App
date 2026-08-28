# Creates the BOLO security roles that enforce edit permissions server-side.
#
#   BOLO Officer       - read everything, but only create/update/delete own records
#   BOLO Administrator - full organization-level access to every BOLO record
#
# Usage: pwsh scripts/create-security-roles.ps1 -Token <bearer token>
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
  "Content-Type"     = "application/json"
}

# PrivilegeDepth enum: Basic = user's own records, Global = all records in the org.
$BASIC = "Basic"
$ORG   = "Global"

$tables = @("new_PersonBolo", "new_VehicleBolo")
$actions = @("Create", "Read", "Write", "Delete", "Append", "AppendTo", "Assign", "Share")

Write-Host "Looking up privileges..."
$privileges = @{}
foreach ($table in $tables) {
  foreach ($action in $actions) {
    $name = "prv$action$table"
    $uri = "$api/privileges?`$select=privilegeid,name&`$filter=name eq '$name'"
    $result = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 90
    if ($result.value.Count -gt 0) {
      $privileges[$name] = $result.value[0].privilegeid
    } else {
      Write-Host "  ! privilege not found: $name"
    }
  }
}
Write-Host "  found $($privileges.Count) privileges"

function Get-RootBusinessUnit {
  $uri = "$api/businessunits?`$select=businessunitid&`$filter=parentbusinessunitid eq null"
  (Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 60).value[0].businessunitid
}

function New-Role($roleName, $businessUnitId) {
  $existing = Invoke-RestMethod -Uri "$api/roles?`$select=roleid&`$filter=name eq '$roleName'" `
    -Headers $headers -TimeoutSec 60
  if ($existing.value.Count -gt 0) {
    Write-Host "  role '$roleName' already exists"
    return $existing.value[0].roleid
  }
  $body = @{
    name                              = $roleName
    "businessunitid@odata.bind"       = "/businessunits($businessUnitId)"
  } | ConvertTo-Json
  $response = Invoke-WebRequest -Method Post -Uri "$api/roles" -Headers $headers -Body $body `
    -TimeoutSec 120 -UseBasicParsing
  $roleId = ($response.Headers["OData-EntityId"] -replace '.*\(([^)]+)\).*', '$1')
  Write-Host "  created role '$roleName'"
  return $roleId
}

# Applies privileges to a role in one AddPrivilegesRole call.
function Set-RolePrivileges($roleId, $depthByPrivilegeName) {
  $list = @()
  foreach ($entry in $depthByPrivilegeName.GetEnumerator()) {
    if (-not $privileges.ContainsKey($entry.Key)) { continue }
    $list += @{
      Depth     = $entry.Value
      PrivilegeId = $privileges[$entry.Key]
      BusinessUnitId = $null
    }
  }
  $body = @{ Privileges = $list } | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Method Post -Uri "$api/roles($roleId)/Microsoft.Dynamics.CRM.AddPrivilegesRole" `
    -Headers $headers -Body $body -TimeoutSec 180 | Out-Null
  Write-Host "    applied $($list.Count) privileges"
}

$rootBu = Get-RootBusinessUnit
Write-Host "Root business unit: $rootBu"

Write-Host "Creating roles..."
$officerRoleId = New-Role "BOLO Officer" $rootBu
$adminRoleId   = New-Role "BOLO Administrator" $rootBu

# Officer: read all BOLOs, but write/delete only their own.
$officerPrivileges = @{}
foreach ($table in $tables) {
  $officerPrivileges["prvCreate$table"]   = $BASIC
  $officerPrivileges["prvRead$table"]     = $ORG
  $officerPrivileges["prvWrite$table"]    = $BASIC
  $officerPrivileges["prvDelete$table"]   = $BASIC
  $officerPrivileges["prvAppend$table"]   = $BASIC
  $officerPrivileges["prvAppendTo$table"] = $ORG
  $officerPrivileges["prvAssign$table"]   = $BASIC
  $officerPrivileges["prvShare$table"]    = $BASIC
}

# Administrator: organization-wide access to everything.
$adminPrivileges = @{}
foreach ($table in $tables) {
  foreach ($action in $actions) {
    $adminPrivileges["prv$action$table"] = $ORG
  }
}

Write-Host "  BOLO Officer:"
Set-RolePrivileges $officerRoleId $officerPrivileges
Write-Host "  BOLO Administrator:"
Set-RolePrivileges $adminRoleId $adminPrivileges

Write-Host ""
Write-Host "Done."
Write-Host "  BOLO Officer       $officerRoleId"
Write-Host "  BOLO Administrator $adminRoleId"
Write-Host ""
Write-Host "Assign these roles to users in the Power Platform admin center."
