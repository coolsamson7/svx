---
description: Read or update Confluence pages — search for documentation, fetch page content, create or update pages in the team wiki. Use when asked to look up docs, write to Confluence, update a page, or find information in the wiki.
allowed-tools: mcp__atlassian__confluence_search mcp__atlassian__confluence_get_page mcp__atlassian__confluence_create_page mcp__atlassian__confluence_update_page mcp__atlassian__confluence_get_page_children mcp__atlassian__confluence_get_comments Bash
---

## Setup (per developer, one-time)

Each developer adds their own API token to `~/.zshrc`:

```bash
export ATLASSIAN_BASE_URL="https://g-portal.atlassian.net"
export ATLASSIAN_USER_EMAIL="your.name@contabo.de"
export ATLASSIAN_API_TOKEN="your-token-here"
```

Generate a token at: `id.atlassian.com → Security → API tokens`

The MCP server config is already in `.claude/settings.json` and picked up automatically.

## Space & page constants (personal space)

```
SPACE_KEY     = ~712020d52fd08929334aaba4036100276741c9
FEATURES_PAGE = 5765726211          # Features index page
BASE_URL      = https://g-portal.atlassian.net
```

Template IDs (space templates — use these when creating sub-pages):
```
Feature         5761204230
UX              5762056193
Datamodel       5790695425
Solution Design 5790728193
Server Logic    5788303420
Client Logic    5788303432
```

Use `${ATLASSIAN_BASE_URL}`, `${ATLASSIAN_USER_EMAIL}`, `${ATLASSIAN_API_TOKEN}` from env in all curl calls.
Always use `python3` for JSON processing (available; `jq` may not be).

## Command: new-feature

**Trigger:** user says `new-feature "Feature Name"` or similar intent to create a new feature page.

**Steps — execute these in order using Bash:**

### Step 1 — find next FEAT number

Fetch children of the Features page and parse the highest existing FEAT-NNN:

```bash
python3 << 'EOF'
import json, subprocess, os, re

BASE  = os.environ["ATLASSIAN_BASE_URL"]
USER  = os.environ["ATLASSIAN_USER_EMAIL"]
TOKEN = os.environ["ATLASSIAN_API_TOKEN"]

r = subprocess.run(
    ["curl", "-s", "-u", f"{USER}:{TOKEN}",
     f"{BASE}/wiki/rest/api/content/5765726211/child/page?limit=200&expand=title"],
    capture_output=True, text=True
)
pages = json.loads(r.stdout).get("results", [])
nums = [int(m.group(1)) for p in pages for m in [re.search(r"FEAT-(\d+)", p["title"])] if m]
next_num = (max(nums) + 1) if nums else 1
print(f"FEAT-{next_num:03d}")
EOF
```

### Step 2 — create the Feature page

Build the page title as `[FEAT-NNN] {Feature Name}` (NNN = zero-padded from step 1).
Use this body (substitute the title and today's date):

```python
import json, subprocess, os

SPACE = "~712020d52fd08929334aaba4036100276741c9"
BASE  = os.environ["ATLASSIAN_BASE_URL"]
USER  = os.environ["ATLASSIAN_USER_EMAIL"]
TOKEN = os.environ["ATLASSIAN_API_TOKEN"]

ADD_PANEL = """<ac:structured-macro ac:name="panel" ac:schema-version="1">
  <ac:parameter ac:name="borderStyle">solid</ac:parameter>
  <ac:parameter ac:name="borderColor">#00875A</ac:parameter>
  <ac:parameter ac:name="borderWidth">2</ac:parameter>
  <ac:parameter ac:name="bgColor">#E3FCEF</ac:parameter>
  <ac:parameter ac:name="titleBGColor">#00875A</ac:parameter>
  <ac:parameter ac:name="titleColor">#FFFFFF</ac:parameter>
  <ac:parameter ac:name="title">+ Add a specification chapter</ac:parameter>
  <ac:rich-text-body>
    <p>Click a link to create a pre-filled child page. Set <strong>Parent page = this feature page</strong> in the create dialog.</p>
    <table>
      <thead><tr><th>Aspect</th><th>Add</th><th>When to use</th></tr></thead>
      <tbody>
        <tr><td><strong>UX</strong></td>
            <td><a href="https://g-portal.atlassian.net/wiki/pages/createpage.action?spaceKey=~712020d52fd08929334aaba4036100276741c9&amp;templateId=5762056193&amp;fromPageId={page_id}">+ Add UX</a></td>
            <td>Wireframes, user flows, Figma links, design decisions</td></tr>
        <tr><td><strong>Datamodel</strong></td>
            <td><a href="https://g-portal.atlassian.net/wiki/pages/createpage.action?spaceKey=~712020d52fd08929334aaba4036100276741c9&amp;templateId=5790695425&amp;fromPageId={page_id}">+ Add Datamodel</a></td>
            <td>Entities, schema changes, migrations, ER diagram</td></tr>
        <tr><td><strong>Solution Design</strong></td>
            <td><a href="https://g-portal.atlassian.net/wiki/pages/createpage.action?spaceKey=~712020d52fd08929334aaba4036100276741c9&amp;templateId=5790728193&amp;fromPageId={page_id}">+ Add Solution Design</a></td>
            <td>Architecture overview, tech decisions, sequence diagrams</td></tr>
        <tr><td><strong>Server Logic</strong></td>
            <td><a href="https://g-portal.atlassian.net/wiki/pages/createpage.action?spaceKey=~712020d52fd08929334aaba4036100276741c9&amp;templateId=5788303420&amp;fromPageId={page_id}">+ Add Server Logic</a></td>
            <td>API endpoints, business rules, NestJS module</td></tr>
        <tr><td><strong>Client Logic</strong></td>
            <td><a href="https://g-portal.atlassian.net/wiki/pages/createpage.action?spaceKey=~712020d52fd08929334aaba4036100276741c9&amp;templateId=5788303432&amp;fromPageId={page_id}">+ Add Client Logic</a></td>
            <td>Svelte components, state, routing, data fetching</td></tr>
      </tbody>
    </table>
  </ac:rich-text-body>
</ac:structured-macro>"""

# Substitute {page_id} AFTER creating the page (step 3 updates with real ID)
BODY = f"""<ac:structured-macro ac:name="panel" ac:schema-version="1">
  <ac:parameter ac:name="borderStyle">solid</ac:parameter>
  <ac:parameter ac:name="borderColor">#0052CC</ac:parameter>
  <ac:parameter ac:name="borderWidth">2</ac:parameter>
  <ac:parameter ac:name="bgColor">#DEEBFF</ac:parameter>
  <ac:parameter ac:name="titleBGColor">#0052CC</ac:parameter>
  <ac:parameter ac:name="titleColor">#FFFFFF</ac:parameter>
  <ac:parameter ac:name="title">Feature Metadata</ac:parameter>
  <ac:rich-text-body>
    <table><tbody>
      <tr><th>Status</th><td><ac:structured-macro ac:name="status" ac:schema-version="1"><ac:parameter ac:name="colour">Grey</ac:parameter><ac:parameter ac:name="title">Draft</ac:parameter></ac:structured-macro></td><th>Owner</th><td>{USER}</td></tr>
      <tr><th>Target Version</th><td></td><th>Priority</th><td></td></tr>
      <tr><th>Jira Tickets</th><td colspan="3"><em>e.g. SVX-123, PROJ-456</em></td></tr>
      <tr><th>Created</th><td>{TODAY}</td><th>Last Updated</th><td>{TODAY}</td></tr>
    </tbody></table>
  </ac:rich-text-body>
</ac:structured-macro>
<h2>Summary</h2><p><em>One paragraph: what this feature does and why it exists.</em></p>
<h2>Business Value</h2><p><em>Why we are building this. What problem does it solve?</em></p>
<h2>Acceptance Criteria</h2>
<ac:task-list>
  <ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body></ac:task-body></ac:task>
  <ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body></ac:task-body></ac:task>
</ac:task-list>
<h2>Open Questions</h2>
<table><thead><tr><th>#</th><th>Question</th><th>Owner</th><th>Status</th></tr></thead>
<tbody><tr><td>1</td><td></td><td></td><td></td></tr></tbody></table>
<h2>Specification Chapters</h2>
{{ADD_PANEL_PLACEHOLDER}}
<ac:structured-macro ac:name="children" ac:schema-version="1">
  <ac:parameter ac:name="sort">creation</ac:parameter>
  <ac:parameter ac:name="style">h4</ac:parameter>
  <ac:parameter ac:name="showDescriptions">true</ac:parameter>
  <ac:parameter ac:name="depth">1</ac:parameter>
</ac:structured-macro>"""

# First create without the Add panel (page ID not known yet)
body_initial = BODY.replace("{ADD_PANEL_PLACEHOLDER}", "<p><em>Loading chapter links…</em></p>")

payload = {
    "type": "page",
    "title": TITLE,  # e.g. "[FEAT-002] My Feature"
    "space": {"key": SPACE},
    "ancestors": [{"id": "5765726211"}],
    "body": {"storage": {"value": body_initial, "representation": "storage"}}
}
with open("/tmp/new_feature.json", "w") as f:
    json.dump(payload, f)

r = subprocess.run(
    ["curl", "-s", "-u", f"{USER}:{TOKEN}", "-X", "POST",
     "-H", "Content-Type: application/json",
     "-d", "@/tmp/new_feature.json",
     f"{BASE}/wiki/rest/api/content"],
    capture_output=True, text=True
)
page = json.loads(r.stdout)
page_id = page["id"]
print(f"Created page ID: {page_id}")
```

### Step 3 — update body with real page ID in Add panel links

After creation, do a PUT with the same body but substitute `{page_id}` in all `fromPageId=` values in ADD_PANEL, then PUT to `/wiki/rest/api/content/{page_id}` with version 2.

### Step 4 — add labels

```bash
curl -s -u "${ATLASSIAN_USER_EMAIL}:${ATLASSIAN_API_TOKEN}" \
  -X POST -H "Content-Type: application/json" \
  "${ATLASSIAN_BASE_URL}/wiki/rest/api/content/{page_id}/label" \
  -d '[{"prefix":"global","name":"svx-feature"},{"prefix":"global","name":"status-draft"}]'
```

### Step 5 — report to user

Print the page URL: `https://g-portal.atlassian.net/wiki/spaces/~712020d52fd08929334aaba4036100276741c9/pages/{page_id}`

---

## Common operations

**Search for pages:**
Use `confluence_search` with a CQL query. Examples:
- `text ~ "deployment"` — full-text search
- `space = "DEV" AND title ~ "architecture"` — search in a space by title
- `label = "adr"` — find pages by label

**Read a page:**
Use `confluence_get_page` with the page ID (visible in the URL: `/wiki/spaces/.../pages/12345678`).

**Create a page:**
Use `confluence_create_page`. Provide `spaceKey`, `title`, `parentId` (optional), and `content` in Confluence storage format (HTML-like XML) or plain text.

**Update a page:**
Use `confluence_update_page`. Always fetch the current version number first with `confluence_get_page` — Confluence rejects updates without the correct version.

**Read child pages:**
Use `confluence_get_page_children` to list sub-pages under a given page ID.

## Confluence storage format

Page content uses Confluence's storage format (XHTML-based). Key elements:

```xml
<p>Paragraph text</p>
<h1>Heading 1</h1>
<ul><li>List item</li></ul>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">typescript</ac:parameter>
  <ac:plain-text-body><![CDATA[const x = 1;]]></ac:plain-text-body>
</ac:structured-macro>
```

When updating pages, preserve all existing content unless explicitly asked to replace it.

## Conventions for this project

- **Space key:** check the URL or ask — personal spaces start with `~`
- Before creating a page, search to confirm it doesn't already exist
- When updating, always include what changed and why in the version comment
- Do not delete pages — archive by adding `[ARCHIVED]` to the title instead
