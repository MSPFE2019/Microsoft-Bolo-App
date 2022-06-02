# Microsoft-Bolo-App

Submit BOLOs to SharePoint list via power app and post to Teams channel

![Screenshot](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/Loading_BOLO_App.jpg)
![Screenshot](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/Main%20Screen.jpg)
![Screenshot](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/SearchVehicle.jpg)


This app uses standard Power Platform Connectors with a SharePoint Backend.

### To import a solution:

Sign into Power Apps and select Solutions from the left navigation.

On the command bar, select Import.

[Microsoft Bolo App, Click to download solution.](https://github.com/MSPFE2019/Microsoft-Bolo-App/blob/main/MicrosoftBOLOApp_1_0_0_4.zip)

On the Import a solution page, select Browse to locate the compressed (.zip or .cab) file that contains the solution you want to import.

Select Next.

Information about the solution is displayed. By default, in the Advanced settings section, if SDK messages and flows exist in the solution, they will be imported. Clear the Enable SDK messages and flows included in the solution option if you want them to import in an inactive state.

If your solution contains connection references, you’ll be prompted to select the connections you want. If a connection does not already exist, create a new one. Select Next.

The solution has one environment variable:

SPO Site for BOLO App- (https://contoso.sharepoint.com/sites/MicrosoftBoloApp)



If missing dependencies are detected in the target environment, a list of the dependencies is presented. In environments where the required package version is available for import in the target environment, a link to resolve the dependency is presented. Selecting the link takes you to the Power Platform admin center where you can install the application update. After the application update is completed, you can start the solution import again.

Select Import.


### Service Account for Power Automate:
Account need E1 - E5 or G1 - G5 license with Power App/Power Automate apps added


### Imported Components:
#### Flows
*CreateList_EyeColor : List for Eye Colors
*CreateList_HairColor : List for Hair Colors
*CreateList_ListofState : List for State Name and Abbr
*CreateList_PersonBolo : Person BOLO will stored here
*CreateList_Vehicle : Vehicle BOLO will stored here
*CreateList_VehicleColor : List of Vehicle Colors
*CreateList_VehicleList : List of Vehicles Make

#### App
BOLO App(Phone)v2


#### Setup app

*Populate created lists(Colors,Vehicles, States on the site with data.
*Navigate to PersonBolo List(Change or add to the Bolo Type field)
*Navigate to Vehicle List(Change or add to the Bolo Type field)
*Remove SharePoint connections from power apps, re-add new connect to new site.
