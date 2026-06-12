import re

with open('src/app/globals.css', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Split before the first instance
parts = content.split("/* ── Ensure table wrapper div inside card also scrolls ── */")

clean_css = parts[0]

clean_css += """/* ── Ensure table wrapper div inside card also scrolls ── */
@media (max-width: 768px) {
  div[style*="overflowX: 'auto'"],
  div[style*="overflow-x: auto"],
  div[style*="overflowX:auto"] {
    -webkit-overflow-scrolling: touch;
  }
  /* Force any hardcoded wide container to stay in viewport */
  div[style*="maxWidth: '850px'"] {
    max-width: calc(100vw - 24px) !important;
  }
  div[style*="maxWidth: '900px'"] {
    max-width: calc(100vw - 24px) !important;
  }
  div[style*="maxWidth: '1000px'"] {
    max-width: calc(100vw - 24px) !important;
  }
  div[style*="width: '100%'"][style*="maxWidth"] {
    width: 100% !important;
  }
}

/* ── Railway Mobile UI Enhancements ── */
@media (max-width: 768px) {
  /* Grids Stack Vertically */
  .grid, .grid-2, .grid-4 {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }

  /* Tables Scroll Smoothly on Touch */
  .table-responsive {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
  
  /* Modal Width Adjustments */
  .fixed[role="dialog"] > div,
  .modal-content,
  [style*="position: fixed"][style*="z-index: 50"] > div {
    width: 95vw !important;
    max-width: 100% !important;
    padding: 16px !important;
    margin: 10px auto !important;
  }

  /* Sidebar wrapper adjusts cleanly */
  .sidebar-corporate {
    width: 280px !important;
    max-width: 80vw !important;
  }
}

/* %% ADDITIONAL MOBILE RESPONSIVENESS (PO Create & Admin) %% */
@media (max-width: 768px) {
  .flex-between { flex-direction: column; align-items: stretch; gap: 16px; }
  .silk-field { margin-bottom: 16px; }
  .grid-3, .grid-4 { grid-template-columns: 1fr; }
  .card-clean { padding: 20px; overflow-x: auto; }
  .table-corporate th, .table-corporate td { white-space: nowrap; padding: 12px 10px; }
  form[style*="display: flex"] { flex-direction: column !important; align-items: stretch !important; }
  .table-corporate input, .table-corporate select { min-width: 120px; }
}
"""

with open('src/app/globals.css', 'w', encoding='utf-8') as f:
    f.write(clean_css)
