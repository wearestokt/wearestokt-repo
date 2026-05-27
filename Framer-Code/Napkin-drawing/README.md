# Napkin Drawing — Framer Code Components

A minimal ink-pen drawing form for Framer. Combine a freehand canvas with a message, name, and email field — all sent as one email.

---

## Files

| File | Purpose |
|---|---|
| `InkDrawCanvas.tsx` | Main component — drawing area + success overlay |
| `InkDrawFormFields.tsx` | Message, name, email inputs (place anywhere) |
| `InkDrawReset.tsx` | Standalone reset button (place anywhere) |
| `InkDrawSend.tsx` | Standalone send button (place anywhere) |
| `InkDrawStore.tsx` | Internal state bridge — Framer code component |
| `emailjs-template.html` | Ready-to-use EmailJS HTML template |

---

## Setup — EmailJS (5 min)

1. Create a free account at [emailjs.com](https://www.emailjs.com)
2. Add an **Email Service** (Gmail, Outlook, etc.) → note the **Service ID**
3. Create an **Email Template**:
   - **Subject:** `Napkin Drawing from {{from_name}}`
   - **Content:** Use the HTML from `emailjs-template.html` in this folder, or paste this minimal version:

```html
<h2>New Napkin Drawing</h2>
<p><strong>From:</strong> {{from_name}} &lt;{{from_email}}&gt;</p>
<p><strong>Message:</strong></p>
<p>{{message}}</p>
<p><strong>Drawing:</strong></p>
<img src="{{drawing}}" alt="Drawing" style="max-width:100%; border-radius:8px;" />
```

   - In EmailJS, set **Content type** to **HTML** for the template.
   - For a full styled template, copy the contents of `emailjs-template.html` in this folder.

4. Note your **Template ID** and **Public Key** (Account → API Keys)

5. In Framer, select `InkDrawCanvas` and fill in the side panel:
   - **EmailJS Service ID**
   - **EmailJS Template ID**
   - **EmailJS Public Key**

---

## Usage in Framer

1. Import all 5 files as code components (InkDrawCanvas, InkDrawFormFields, InkDrawReset, InkDrawSend, InkDrawStore)
2. Place `InkDrawCanvas` on your frame — resize freely (fill/fixed both work)
3. Place `InkDrawFormFields` for message, name, and email inputs — position anywhere
4. Place `InkDrawReset` and `InkDrawSend` anywhere on your canvas
5. Style the buttons and form however you want — they are linked through the store
6. Customize all settings from the right-side panel

### Button states (InkDrawSend)
- Default → shows your children or the default "Send" label
- Loading → shows **Loading Label** prop
- Success → shows **Success Label** prop and disables itself

---

## Property Controls reference

### InkDrawCanvas
| Control | Default | Description |
|---|---|---|
| Pen Color | #1a1a1a | Ink colour |
| Pen Width | 2 | Base stroke width (thins at speed) |
| Cursor Dot Size | 4 | Size of the cursor dot (px) |
| Export Max Size | 800 | Max dimension for email (avoids 413) |
| Export Quality | 0.85 | JPEG quality 0.5–1 |
| Export Background | #ffffff | Background color in emailed image |
| Canvas Background | #faf8f5 | Drawing area background |
| Corner Radius | 8 | Canvas border radius |
| Success Message | "Thank you…" | Shown in canvas area after send |
| Overlay Font Size | 14 | Success/loading overlay text size |
| Overlay Text Color | #1a1a1a | Success/loading overlay text colour |
| Success Message Font | — | Native Framer font picker (font + weight) |
| EmailJS Service ID | — | From EmailJS dashboard |
| EmailJS Template ID | — | From EmailJS dashboard |
| EmailJS Public Key | — | From EmailJS dashboard |

### InkDrawFormFields
| Control | Default | Description |
|---|---|---|
| Max Characters | 265 | Message textarea limit |
| Message Placeholder | "Write a message…" | Textarea hint text |
| Name Placeholder | "Your name" | Name input hint |
| Email Placeholder | "Your email" | Email input hint |
| Message Min Height | 60 | Minimum height of message box (px) |
| Input Font Size | 13 | Field text size |
| Input Text Color | #1a1a1a | Field text colour |
| Form Font | — | Native Framer font picker |

### InkDrawSend
| Control | Default | Description |
|---|---|---|
| Loading Label | "Sending…" | Text shown while sending |
| Success Label | "Sent" | Text shown after success |
| Label Font Size | 13 | Font size for default/label text |
| Label Font | — | Native Framer font picker |
