# stokt-clickup

All ClickUp-related files for this repository live in this folder.

- API clients, utilities, and helpers
- Integration code
- Documentation and notes
- Scripts that interact with ClickUp

---

## ClickUp Forms → Tally Migration

Migrates ClickUp form views from the Stokt workspace to Tally.

### Run

```bash
cd stokt-clickup
CLICKUP_API_KEY="pk_xxx" TALLY_API_KEY="tly_xxx" node clickup-to-tally-migrate.mjs
```

### Options

- `DRY_RUN=1` — Discover and save spec only, do not create Tally forms
- `FROM_SPEC=1` — Skip discovery; create Tally forms from existing `clickup-forms-spec.json`
- `CLICKUP_TEAM_ID` — Default: 9011203786 (Stokt workspace)

### Output

- `clickup-forms-spec.json` — Discovered form specs (name, fields, types)
- Forms created in Tally as DRAFT (review and publish in Tally)

### Manual spec fallback

If discovery fails or you need to migrate a form not in ClickUp:

1. Copy `clickup-forms-spec.template.json` to `clickup-forms-spec.json` (or add entries to an existing spec)
2. Edit the spec with your form name and fields
3. Run with `FROM_SPEC=1` to create Tally forms from the spec

Example entry:

```json
{
  "name": "Form Name",
  "description": "Optional description",
  "fields": [
    { "name": "Question", "type": "text", "required": false },
    { "name": "Email", "type": "email", "required": true },
    { "name": "Stage", "type": "drop_down", "type_config": { "options": [{ "name": "Option A" }] } }
  ]
}
```

Supported `type` values: `text`, `long_text`, `email`, `phone`, `url`, `number`, `date`, `checkbox`, `drop_down`, `labels`, `attachment`.

### Field type mapping (ClickUp → Tally)

| ClickUp       | Tally                 |
|---------------|-----------------------|
| short_text, text | INPUT_TEXT         |
| long_text     | TEXTAREA              |
| email         | INPUT_EMAIL           |
| phone         | INPUT_PHONE_NUMBER    |
| url           | INPUT_LINK            |
| number, currency | INPUT_NUMBER       |
| date          | INPUT_DATE            |
| checkbox      | CHECKBOXES            |
| drop_down     | DROPDOWN              |
| labels, users | MULTIPLE_CHOICE       |
| emoji         | RATING                |
| files, attachment | FILE_UPLOAD       |

Unmapped types fall back to `INPUT_TEXT`.
