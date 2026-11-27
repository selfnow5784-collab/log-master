# Tool Dude

Tool Dude is an offline catalog and inventory reference app. It runs in a web browser and can be installed on a phone or computer. Your catalog data stays on that device and works without the internet.

The live app is at:
https://selfnow5784-collab.github.io/tool-dude/

## How it is hosted

The app is hosted for free on GitHub Pages. GitHub serves the files from the root of the `main` branch in this repository:
https://github.com/selfnow5784-collab/tool-dude

## How to update the app

1. Open the repository: https://github.com/selfnow5784-collab/tool-dude
2. If you changed any app file, open `sw.js` and bump the `VERSION` value. It is currently `td-v1.5.1`. Change it each time (for example to `td-v1.5.2`) so phones and computers pick up the new files.
3. Click **Add file**, then **Upload files**.
4. Choose the files you want to replace, then commit the upload.
5. Wait a minute or two for GitHub Pages to update, then check the live app.

Do not upload supplier CSV files (or any catalog data) to this public repository. Load those files in the app on your own device instead.

## How to install the app

- **iPhone:** Open the live app in Safari, tap Share, then Add to Home Screen.
- **Android:** Open the live app in Chrome, then tap Install app.
- **PC:** Open the live app in Chrome or Edge, then click the install icon in the address bar.

## How to load a CSV catalog

1. Open the app.
2. Tap **Data** at the top.
3. Tap **Import new CSV** and choose a `.csv` file.
4. If a catalog is already loaded, the app asks **Replace the loaded file?** You can save a copy first, replace without saving, or cancel.
5. The Data tab then shows the loaded file name and row count. Use **Export catalog** to download a copy, or **Empty** to unload the file (your in-stock list and settings stay).

If the app asks **What is this file?**, choose the kind of file (for example **Reference catalog**), check the Import preview, and tap **Import**.

## How to download a backup of the code

Download a zip of the current code (no catalog data) from:
https://github.com/selfnow5784-collab/tool-dude/archive/refs/heads/main.zip

## How to host it somewhere else

If you need a new home for the app, you can upload these same files (as they are) to any free static host, such as:

- GitHub Pages on a new account
- Netlify Drop
- Cloudflare Pages

Point the host at the files in the zip (the folder that contains `index.html`, `sw.js`, `styles.css`, and the `js` folder).
