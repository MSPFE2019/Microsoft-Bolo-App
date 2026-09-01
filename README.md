# BOLO App

A **BOLO** ("Be On the Lookout") app for law enforcement dispatch. Officers can issue, search, and update alerts for missing people, wanted persons, and stolen vehicles.

It is built as a **Power Apps Code App** — a normal React + TypeScript web app that runs inside Power Apps and stores its data in Dataverse.

---

## Just want to install it? Start here.

If you only want to *run* the app in your own Power Platform environment, you do **not** need to build anything or install any developer tools. Skip to **[Install the app](#install-the-app-no-coding-required)**.

If you want to *change the code*, see **[Set up for development](#set-up-for-development)**.

---

## What the app does

- **Two kinds of BOLO** — Person and Vehicle, each with its own fields.
- **Search** — filter by name, case number, plate, description, and more.
- **Status tracking** — every BOLO is Open, Closed, or Archived. Only Open records show by default.
- **Photos** — attach a photo to a record.
- **Roles** — Officers can search and create; Administrators can also edit any record and customize the app.
- **Customizable fields** — administrators can add, remove, rename, and reorder form fields without touching code. See [Customize fields](#customize-fields-administrators).

---

## Install the app (no coding required)

### What you need first

1. A **Power Platform environment** with **Dataverse** enabled.
2. The **System Administrator** role in that environment.
3. A Power Apps license for everyone who will use the app.

### Which file do I pick?

There are two files in the [`solutions/`](solutions) folder. They contain the same app — the difference is how locked-down it is:

| File | Use it when | Can you edit it after import? |
| --- | --- | --- |
| `BoloCodeApp_managed.zip` | **Most people should pick this.** For production, or any environment where you just want to run the app. | No — it's read-only, and can be cleanly uninstalled. |
| `BoloCodeApp.zip` | You want to modify the app inside Power Apps, or you're setting up a development environment. | Yes — but it cannot be cleanly uninstalled. |

> **Rule of thumb:** use **managed** unless you specifically intend to edit the app in the target environment.

### Import steps

1. Download the `.zip` file you chose from the [`solutions/`](solutions) folder.
   *(On GitHub: click the file, then click **Download raw file**. Do not unzip it.)*
2. Go to [make.powerapps.com](https://make.powerapps.com) and sign in.
   *(US Government cloud: use [make.gov.powerapps.us](https://make.gov.powerapps.us).)*
3. Confirm you're in the right environment using the environment picker in the top-right corner.
4. In the left menu, select **Solutions**.
5. On the toolbar, select **Import solution**.
6. Select **Browse**, choose the `.zip` file, then select **Next**.
7. Review the solution details, then select **Import**. This takes a few minutes.
8. When it finishes, you'll see the **BOLO Code App** solution in your list.

### What gets installed

| Component | What it's for |
| --- | --- |
| `new_personbolo` table | Stores person BOLOs |
| `new_vehiclebolo` table | Stores vehicle BOLOs |
| `new_boloconfig` table | Stores the admin field configuration |
| `BOLO Officer` security role | Search and create BOLOs |
| `BOLO Administrator` security role | Everything an officer can do, plus edit any record and customize fields |
| BOLO App | The app itself |

### After importing: assign security roles

**This step is required.** Nobody can use the app until they have a role.

1. Go to the [Power Platform admin center](https://admin.powerplatform.microsoft.com).
2. Select **Environments**, choose your environment, then select **Settings**.
3. Under **Users + permissions**, select **Users**.
4. Select a user, then select **Manage security roles**.
5. Tick **BOLO Officer** (or **BOLO Administrator**), then **Save**.

> **Give at least one person the `BOLO Administrator` role** — otherwise nobody can customize fields or edit other people's records. The app decides whether you're an admin by checking this exact role, so the name must not be changed.

### Share the app

1. In [make.powerapps.com](https://make.powerapps.com), select **Apps**.
2. Select **BOLO App**, then select **Share**.
3. Add your users or a security group, then **Share**.

---

## Using the app

### Create a BOLO
Select **＋ New BOLO**, choose **Person** or **Vehicle**, fill in the fields, and select **Create BOLO**. Only the fields your administrator has enabled will appear.

### Search
Type in the search box to match across all visible fields. Use the **Status** buttons to include Closed or Archived records — by default you only see **Open** ones.

### Edit or close a BOLO
Select a record to open it. If you created it (or you're an administrator), select **Edit**, change the **Status** to `Closed` or `Archived`, and save.

---

## Customize fields (administrators)

Administrators see a **⚙ Customize fields** button on the main page. It lets you:

- Show or hide any field on the **form** and the **search results card**, independently
- Reorder fields
- Rename field labels
- Mark fields required
- Edit the choices in any dropdown or checkbox list

Changes are saved to Dataverse and apply to **everyone** using the app.

### Adding a new field

You add fields **to the Dataverse table**, and the app picks them up. Nothing is created from inside the app, so a field always has real storage behind it.

**Step 1 — Add the column in Power Apps.**

1. Go to [make.powerapps.com](https://make.powerapps.com) and select **Tables**.
2. Open **Person BOLO** (`new_personbolo`) or **Vehicle BOLO** (`new_vehiclebolo`).
   *Add the column to both tables if the field should apply to both.*
3. Select **+ New column**, give it a display name, pick a data type, and **Save**.

**Step 2 — Refresh in the app.**

1. Open **⚙ Customize fields**.
2. Select **↻ Refresh from Dataverse**. New columns are listed with a summary of what changed.
3. Tick **Form** and/or **Card** to decide where the field appears, then **Save configuration**.

New fields start hidden, so a column added for some other purpose never disrupts the form until you choose to show it.

### Removing a field

Delete the column in Power Apps, then select **↻ Refresh from Dataverse** and **Save configuration**. The field disappears from the app. Built-in fields cannot be deleted, but you can untick **Form** to hide them.

### Which column types are supported

| Dataverse type | Appears in the app as |
| --- | --- |
| Text | Single-line box |
| Text (long) / Multiline | Multi-line box |
| Date and time | Date picker |
| Choice | Dropdown |
| Yes/No | Dropdown |
| Whole number, Decimal, Currency | Single-line box |

Lookup, customer, and owner columns are skipped, because they reference other records rather than holding a plain value.

---

## Set up for development

Only needed if you want to change the code.

### Install these first

| Tool | Notes |
| --- | --- |
| [Node.js](https://nodejs.org) LTS | Includes `npm` |
| [Power Platform CLI](https://aka.ms/PowerAppsCLI) | Provides the `pac` command |
| [Git](https://git-scm.com) | To clone this repo |

### Run it on your machine

```bash
git clone https://github.com/MSPFE2019/Microsoft-Bolo-App.git
cd Microsoft-Bolo-App
npm install
npm run dev
```

Open the URL it prints (usually <http://localhost:3000>).

Locally the app uses **built-in sample data** — it does not touch Dataverse, so you can experiment freely. Local mode also signs you in as an administrator so you can try the admin features.

### Build

```bash
npm run build
```

Output goes to `dist/`.

### Deploy your changes

```bash
# One-time: connect to your environment
pac auth create --environment <your-environment-id>

# Every time you deploy
npm run build
npx @microsoft/power-apps-cli app push --solution-id <your-solution-guid>
```

Find your solution's GUID with:

```bash
npx @microsoft/power-apps-cli solution list
```

> For US Government (GCC) environments, set `CLOUD_INSTANCE=gccmoderate` and `ENVIRONMENT_ID=<your-environment-id>` before pushing.

### Export the solution files yourself

After pushing, re-export both `.zip` files from **make.powerapps.com** → **Solutions** → select **BOLO Code App** → **Export solution**, choosing **Unmanaged** and then **Managed**. Save them into `solutions/`.

---

## How the code is organized

| Path | What's in it |
| --- | --- |
| `src/App.tsx` | Main screen — search, list, detail, and form |
| `src/fieldConfig.ts` | Defines every built-in field and the config format |
| `src/FieldAdmin.tsx` | The **Customize fields** admin screen |
| `src/FieldInput.tsx` | Renders a single form field |
| `src/customColumns.ts` | Maps discovered fields to Dataverse columns |
| `src/services/schemaService.ts` | Reads the live table schema to discover added columns |
| `src/services/boloService.ts` | Sample data used when running locally |
| `src/services/dataverseService.ts` | Real Dataverse reads/writes and the admin role check |
| `src/services/configService.ts` | Saves and loads the field configuration |
| `scripts/` | PowerShell setup scripts |
| `solutions/` | Importable managed and unmanaged solution files |

The app talks to Dataverse through one interface (`BoloService`), with two implementations — sample data locally, Dataverse when deployed. Everything else is unaware of which one is in use.

---

## Troubleshooting

**I don't see the ⚙ Customize fields button.**
You need the `BOLO Administrator` security role. Assign it in the admin center (see [above](#after-importing-assign-security-roles)), then hard-refresh the app with `Ctrl`+`Shift`+`R`. If it still doesn't appear, open your browser console (`F12`) and look for a line starting with `[BOLO] role check` — it reports the role the app resolved and why.

**A field I added doesn't show up on the form.**
Open **⚙ Customize fields**, select **↻ Refresh from Dataverse**, tick **Form** next to the field, then **Save configuration**. If Refresh doesn't find it, confirm you added the column to the right table (`new_personbolo` for people, `new_vehiclebolo` for vehicles) and that its type is one of the [supported types](#which-column-types-are-supported).

**The app is blank or shows a loading error.**
Usually a missing security role. Confirm the user has `BOLO Officer` or `BOLO Administrator`.

**My changes don't appear after deploying.**
Your browser cached the old version. Hard-refresh with `Ctrl`+`Shift`+`R`.

---

## License

See [LICENSE](LICENSE).
