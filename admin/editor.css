:root {
  color-scheme: light;
  --brand: #01457e;
  --brand-dark: #00345f;
  --accent: #dca55f;
  --line: #d8e3ed;
  --soft: #f3f7fb;
  --panel: #fff;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--brand);
  background: var(--soft);
}

button,
input,
select,
textarea {
  font: inherit;
}

.editor-header {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(360px, 720px);
  gap: 20px;
  align-items: end;
  padding: 22px;
  color: #fff;
  background: linear-gradient(120deg, var(--brand), var(--brand-dark));
}

.editor-header p,
.editor-header h1 {
  margin: 0;
}

.editor-header p {
  color: #f0c17c;
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.editor-header h1 {
  margin-top: 6px;
  font-size: clamp(1.8rem, 4vw, 3.2rem);
  line-height: 1;
}

.repo-panel {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto auto;
  gap: 10px;
  align-items: end;
}

label {
  display: grid;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 900;
}

input,
select,
textarea {
  min-height: 42px;
  padding: 0 12px;
  color: var(--brand);
  background: #fff;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 8px;
  outline: none;
}

textarea {
  min-height: 92px;
  padding-block: 10px;
  line-height: 1.45;
  resize: vertical;
}

input[type="color"] {
  width: 100%;
  min-height: 42px;
  padding: 5px;
  cursor: pointer;
}

button {
  min-height: 42px;
  padding: 0 14px;
  color: var(--brand-dark);
  background: #fff;
  border: 1px solid rgba(1, 69, 126, 0.14);
  border-radius: 999px;
  cursor: pointer;
  font-weight: 900;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
}

button.secondary {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
}

.editor-shell {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 18px;
  height: calc(100vh - 118px);
  padding: 18px;
}

.editor-sidebar,
.preview-panel {
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 18px 54px rgba(1, 69, 126, 0.1);
}

body:not(.is-authenticated) .editor-shell {
  opacity: 0.42;
  pointer-events: none;
}

body:not(.is-authenticated) [data-save-github],
body:not(.is-authenticated) [data-logout] {
  display: none;
}

body.is-authenticated [data-login],
body.is-authenticated [data-username],
body.is-authenticated [data-password],
body.is-authenticated .repo-panel label {
  display: none;
}

.editor-sidebar {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px;
}

.editor-guide {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.editor-guide strong {
  color: var(--brand-dark);
  font-size: 0.9rem;
}

.editor-guide ol {
  margin: 0;
  padding-left: 18px;
  color: #426f96;
  font-size: 0.8rem;
  line-height: 1.5;
}

.status {
  padding: 12px;
  color: var(--brand-dark);
  background: #eef5fb;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 0.92rem;
  line-height: 1.45;
}

.status.is-error {
  color: #7a241f;
  background: #fff2ee;
  border-color: #f3c1b7;
}

.status.is-success {
  color: #064f3e;
  background: #eefaf5;
  border-color: #bce8d5;
}

.style-panel,
.image-panel,
.custom-panel,
.media-panel,
.block-editor-panel {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #f8fbfe;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.video-manager {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #fff8ee;
  border: 1px solid #efd3a7;
  border-radius: 8px;
}

.video-manager[hidden] {
  display: none;
}

.style-panel-head {
  display: grid;
  gap: 3px;
}

.style-panel-head strong {
  color: var(--brand-dark);
  font-size: 0.88rem;
}

.style-panel-head span {
  color: #426f96;
  font-size: 0.78rem;
  line-height: 1.35;
}

.style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.style-action-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.style-format-button.is-active {
  color: #fff;
  background: var(--brand);
  border-color: var(--brand);
}

.image-add-box {
  display: grid;
  gap: 10px;
  padding: 10px;
  background: #fff;
  border: 1px solid rgba(1, 69, 126, 0.12);
  border-radius: 8px;
}

.panel-note {
  margin: 0;
  color: #426f96;
  font-size: 0.78rem;
  line-height: 1.45;
}

.style-panel input,
.style-panel select,
.custom-panel input,
.custom-panel textarea,
.image-panel input,
.image-panel textarea,
.media-panel input,
.media-panel select,
.media-panel textarea,
.video-manager input,
.video-manager select,
.video-manager textarea {
  min-height: 38px;
  border-color: var(--line);
}

.style-panel button,
.image-panel button,
.custom-panel button,
.media-panel button,
.block-editor-panel button {
  min-height: 38px;
  width: 100%;
}

button.light {
  color: var(--brand);
  background: #fff;
  border-color: var(--line);
}

.video-admin-list {
  display: grid;
  max-height: 190px;
  gap: 8px;
  overflow: auto;
}

.video-admin-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.video-admin-actions button {
  min-height: 34px;
  width: auto;
  padding-inline: 10px;
}

.custom-admin-list {
  display: grid;
  gap: 8px;
}

.custom-admin-empty {
  margin: 0;
  color: #426f96;
  font-size: 0.8rem;
  line-height: 1.4;
}

.custom-admin-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: #fff;
  border: 1px solid rgba(1, 69, 126, 0.12);
  border-radius: 8px;
}

.custom-admin-item strong,
.custom-admin-item span {
  display: block;
}

.custom-admin-item strong {
  color: var(--brand-dark);
  font-size: 0.82rem;
}

.custom-admin-item span {
  color: #426f96;
  font-size: 0.76rem;
  line-height: 1.35;
}

.custom-admin-item button {
  min-height: 34px;
  width: auto;
  padding-inline: 10px;
}

button.danger {
  color: #7a241f;
  background: #fff2ee;
  border-color: #f3c1b7;
}

.block-list {
  display: grid;
  gap: 8px;
}

.block-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(1, 69, 126, 0.12);
  border-radius: 8px;
}

.block-card.is-dragging {
  opacity: 0.62;
}

.block-card.is-drop-target {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(220, 165, 95, 0.18);
}

.block-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.drag-handle,
.block-mini {
  min-height: 34px;
  width: auto;
  padding-inline: 10px;
}

.drag-handle {
  color: #426f96;
  background: #eef5fb;
  border-color: var(--line);
  cursor: grab;
}

.block-card-copy {
  display: grid;
  gap: 3px;
  width: 100%;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 0;
  text-align: left;
}

.block-card-copy strong,
.block-card-copy span {
  display: block;
}

.block-card-copy strong {
  color: var(--brand-dark);
  font-size: 0.88rem;
}

.block-card-copy span {
  color: #426f96;
  font-size: 0.76rem;
  line-height: 1.35;
}

.block-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 10px;
  color: var(--brand-dark);
  background: #eef5fb;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.block-order {
  color: #426f96;
  font-size: 0.76rem;
  font-weight: 700;
}

.block-card-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.video-admin-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: #fff;
  border: 1px solid rgba(1, 69, 126, 0.12);
  border-radius: 8px;
}

.video-admin-item strong,
.video-admin-item span {
  display: block;
}

.video-admin-item strong {
  color: var(--brand-dark);
  font-size: 0.82rem;
}

.video-admin-item span {
  color: #426f96;
  font-size: 0.76rem;
  line-height: 1.35;
}

.video-admin-item button {
  min-height: 34px;
  padding-inline: 10px;
}

.field-list {
  display: grid;
  gap: 8px;
  overflow: auto;
  padding-right: 4px;
}

.field-card {
  display: grid;
  gap: 5px;
  padding: 11px;
  color: var(--brand);
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}

.field-card.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(220, 165, 95, 0.2);
}

.field-card strong {
  font-size: 0.82rem;
}

.field-card span {
  color: #426f96;
  font-size: 0.82rem;
  line-height: 1.35;
}

.preview-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}

.preview-toolbar span {
  color: #426f96;
  font-size: 0.9rem;
}

iframe {
  width: 100%;
  height: 100%;
  background: #fff;
  border: 0;
}

@media (max-width: 980px) {
  .editor-header,
  .repo-panel,
  .editor-shell {
    grid-template-columns: 1fr;
  }

  .editor-shell {
    height: auto;
  }

  .preview-panel {
    height: 72vh;
  }

  .block-card-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
