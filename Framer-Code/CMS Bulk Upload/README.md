# CMS Bulk Upload

Framer plugin for bulk-uploading images into a CMS collection via drag and drop. Each file becomes a new CMS item with the filename (without extension) as the title and slug.

## Setup

```bash
cd "Framer-Code/CMS Bulk Upload"
npm install
npm run dev
```

Open the plugin in Framer from the CMS collection view or via [framer.com/plugins/open](https://framer.com/plugins/open/).

## Usage

1. Select a CMS collection.
2. Choose which **string** field receives the title and which **image** field receives the upload.
3. Drop or browse for JPEG, PNG, WebP, or GIF files (max 10 MB each).
4. Click **Upload** to create one CMS item per valid file.

Uploads run sequentially. Failures are collected and shown in a summary without stopping the batch.

## Build

```bash
npm run build
npm run pack
```
