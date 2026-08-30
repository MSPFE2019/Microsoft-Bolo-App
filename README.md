# BOLO App — Power Apps Code App

This repository is being remade as a React/TypeScript Power Apps Code App. The starter keeps the original app's core workflow: submit and search person or vehicle BOLOs, with records ready to be backed by Dataverse and posted to Teams through Power Automate.

## Run locally

```bash
npm install
npm run dev
```

The app starts with representative demo records. `src/services/boloService.ts` is the local integration boundary, and `src/services/dataverseService.ts` adapts the generated Power Apps Dataverse services to the UI's record model.

## Connect Dataverse

Create two Dataverse tables in the target environment, such as `new_personbolo` and `new_vehicle`, with these columns:

| Column | Type |
| --- | --- |
| `new_subject` | Text |
| `new_bolotype` | Text or Choice |
| `new_bolostatus` | Choice: Open, Closed, Transferred |
| `new_casenumber` | Text |
| `new_details` | Multiline text |
| `new_lastknownlocation` | Text |
| `new_secondary` | Text |

After initializing the code app for the environment, register both tables so Power Apps generates strongly typed services:

```powershell
pac code add-data-source --connector dataverse --table new_personbolo
pac code add-data-source --connector dataverse --table new_vehicle
```

Pass the generated services to `createDataverseBoloService` in `src/services/boloService.ts` (or a small environment-specific composition module). This keeps Dataverse authentication and generated API details out of the responsive UI.

## Power Platform integration

The original solution and its SharePoint/Teams workflow definitions remain available in `MicrosoftBOLOApp_1_0_0_4.zip`. The new code app intentionally does not include environment-specific connection secrets or URLs. Configure those in the Power Platform environment and expose only the required operations to the service adapter.

## Build

```bash
npm run build
```

## Original solution

The original canvas app submitted BOLOs to SharePoint and posted them to Teams.

![Screenshot](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/Loading_BOLO_App.jpg)
![Screenshot](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/Main%20Screen.jpg)
![Screenshot](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/SearchVehicle.jpg)


This app uses standard Power Platform connectors with a SharePoint backend.

## Import the solution

Sign in to Power Apps and select **Solutions** from the left navigation.

On the command bar, select **Import**.

[Download Microsoft Bolo App solution](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/MicrosoftBOLOApp_1_0_0_4.zip)

On the Import a solution page, select Browse to locate the compressed (.zip or .cab) file that contains the solution you want to import.

Select Next.

Information about the solution is displayed. By default, in the **Advanced settings** section, if SDK messages and flows exist in the solution, they are imported. Clear the **Enable SDK messages and flows included in the solution** option if you want them imported in an inactive state.

If your solution contains connection references, you’ll be prompted to select the connections you want. If a connection does not already exist, create a new one. Select Next.

The solution has one environment variable:

`SPO Site for BOLO App` - `https://contoso.sharepoint.com/sites/MicrosoftBoloApp`



If missing dependencies are detected in the target environment, a list of the dependencies is presented. In environments where the required package version is available for import in the target environment, a link to resolve the dependency is presented. Selecting the link takes you to the Power Platform admin center where you can install the application update. After the application update is completed, you can start the solution import again.

Select Import.


## Service account for Power Automate

The account needs an E1-E5 or G1-G5 license with Power Apps and Power Automate enabled.


## Imported components

### Flows
- `CreateList_EyeColor`: List for eye colors
- `CreateList_HairColor`: List for hair colors
- `CreateList_ListofState`: List for state names and abbreviations
- `CreateList_PersonBolo`: Person BOLO records are stored here
- `CreateList_Vehicle`: Vehicle BOLO records are stored here
- `CreateList_VehicleColor`: List of vehicle colors
- `CreateList_VehicleList`: List of vehicle makes

### App
`BOLO App (Phone) v2`

## App setup

- Populate the created lists (colors, vehicles, and states) on the site with data.
- Navigate to the `PersonBolo` list and change or add values to the `Bolo Type` field.
- Navigate to the `Vehicle` list and change or add values to the `Bolo Type` field.
- Remove SharePoint connections from Power Apps, then re-add a connection to the new site.

## Teams adaptive card setup

### Missing person adaptive card
- Create Teams channels that correspond to your BOLO type.
- Open and edit `Missing Person AC Posting`. In the `Switch` step (last step in the flow), adjust `Case` and `Case 2` to match your BOLO type.
- Update `Post adaptive card in a chat or channel` steps with the correct team and channel names.

### Vehicle adaptive card
- Create Teams channels that correspond to your BOLO type.
- Open and edit `Vehicle AC Posting`. In the `Switch` step (last step in the flow), adjust `Case` and `Case 2` to match your BOLO type.
- Update `Post adaptive card in a chat or channel` steps with the correct team and channel names.
