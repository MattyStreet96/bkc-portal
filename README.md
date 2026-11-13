# TKC 2027 Parent Research Portal

Survey for MightE Bambino and Cadet parents, saved straight into a Google Sheet, with a staff-only dashboard.

## What's in the folder

| File | What it does |
|---|---|
| `apps-script/Code.gs` | The backend. Saves answers to the Google Sheet and controls who can see the dashboard |
| `apps-script/Form.html` | The survey people fill in: landing page, details, questions, 2027 plans, then the free entry reveal |
| `apps-script/Admin.html` | The dashboard: what matters most, class splits, comments, follow-up list, all responses, CSV export |
| `site/index.html` | The same survey as one standalone page, for hosting at BKC.drivenmotorsportgroup.co.uk |

## How the data is saved

- **As soon as a parent finishes step 1** (name, email, phone, driver), a row is created in the sheet with status **Started**. If they stop there, you still have the lead.
- **When they submit**, the same row is filled in and marked **Completed**.
- Rows that are still "Started" are highlighted yellow in the sheet. They also appear in the dashboard's Follow up list.

## Setup (about 15 minutes)

### 1. Create the sheet and add the code

1. In Google Drive, create a new Google Sheet called **TKC 2027 Parent Research**. Put it in the shared drive so the team can see it.
2. In the sheet, go to **Extensions > Apps Script**.
3. Replace the contents of `Code.gs` with the `Code.gs` from this folder.
4. Click **+ > HTML** and create a file called exactly `Form`. Paste in `Form.html`.
5. Click **+ > HTML** again and create a file called exactly `Admin`. Paste in `Admin.html`.
6. At the top of `Code.gs`, add every email that should see the dashboard to `ADMIN_EMAILS`.
7. Save. Choose **setup** in the function menu and click **Run**. Approve the permissions when Google asks, which happens the first time only. A **Responses** tab appears in the sheet with all the headers.

### 2. Deploy the survey (public)

1. Click **Deploy > New deployment > Web app**.
2. Set **Execute as** to **Me** and **Who has access** to **Anyone**.
3. Click **Deploy** and copy the URL ending in `/exec`. This is the **survey URL**, and it already works.

### 3. Deploy the dashboard (staff only)

1. Click **Deploy > New deployment > Web app** again.
2. Set **Execute as** to **Me** and **Who has access** to **Anyone within [your Workspace domain]**.
3. Copy that URL and add `?page=admin` to the end. This is the **dashboard URL**. Bookmark it.

The dashboard only opens for accounts listed in `ADMIN_EMAILS`. Those accounts must be in the same Google Workspace as the script owner, because Google only shares a signed-in user's email inside the same organisation.

### 4. Put it on BKC.drivenmotorsportgroup.co.uk

**Option A: standalone page (recommended, best on mobile)**

1. Open `site/index.html`. Find `var TKC_ENDPOINT = "__ENDPOINT__";` and replace `__ENDPOINT__` with the survey URL from step 2.
2. Host that one file on any static host, then point the subdomain at it:
   - **Netlify**: drag the `site` folder onto app.netlify.com/drop, add the custom domain `bkc.drivenmotorsportgroup.co.uk`, then add the CNAME record it gives you in your DNS.
   - **Cloudflare Pages**: the same process. Upload the folder, add the custom domain, then add the CNAME.
   - Or send the file to On Track Marketing to host alongside the TKC site.
3. Submissions go straight to the Google Sheet. Nothing else needs changing.

**Option B: all inside Google (no outside hosting)**

1. Create a new Google Site, then use **Insert > Embed > By URL** and paste the survey URL. Stretch the embed to full width and about 1,800px tall.
2. Publish, then go to **Settings > Custom domains** and add `bkc.drivenmotorsportgroup.co.uk`.
3. In DNS, add a CNAME record: `bkc` pointing to `ghs.googlehosted.com`.

This works, but the form sits inside a Google Sites frame, so scrolling on phones is less smooth than Option A.

## Changing things later

- **Questions or wording**: edit `Form.html`, then **Deploy > Manage deployments > Edit > New version**. The URL stays the same. If you're on Option A, update `site/index.html` too.
- **Adding a question**: add the field in `Form.html` and add a matching line to `COLUMNS` in `Code.gs`. Then add the new header to the end of row 1 in the sheet, or delete the Responses tab and run `setup` again.
- **Offer terms link**: in `Form.html`, set `OFFER_TERMS_URL` to the terms page and a "Read the full terms" link appears under the offer.

## Built in

- Required fields and email and phone checks, with clear error messages.
- A consent tick box linking to the TKC privacy policy.
- A hidden spam trap that quietly ignores bot submissions.
- Protection so text typed into the form can't run as a spreadsheet formula.
- A lock so two people submitting at once can't overwrite each other.
