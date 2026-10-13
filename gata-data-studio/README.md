# Gata Data Studio

**Live app:** https://gata-data-studio.goumougata23.chatgpt.site

A browser-based data visualization app created by Gata Goumou for Kean University coursework, with ChatGPT assisting implementation. Upload CSV or flat JSON, choose bar/line/scatter, select columns, group by sum/average/count, search rows, inspect values, preview all rows with pagination, and export SVG charts. Sample data is illustrative.

## Run and deploy
The production files are in `dist/`. Any static hosting platform can serve them. No installation, build, API key, or database is required for this visualization version.

For Vercel: import this repository, set the Root Directory to `gata-data-studio`, choose Other as the framework, leave the build command empty, and set the output directory to `dist`. For Render: create a Static Site from this repository, set the Root Directory to `gata-data-studio`, leave the build command empty, and use `dist` as the publish directory. The current live app is hosted through Sites. This folder is a portable copy of its public static source.

Uploaded data is processed locally and is not sent to a server. Refreshing the page resets to the sample. Files must be at most 5 MB, 10,000 rows, and 60 columns. Charts show at most 80 groups or 1,000 scatter points and disclose truncation; the table shows all matched records. Numeric columns accept finite numbers and numeric strings; blanks and nonnumeric values are excluded from numeric calculations. Percent signs and thousands separators are not silently interpreted as numbers. The visualization app does not call an LLM at runtime.
