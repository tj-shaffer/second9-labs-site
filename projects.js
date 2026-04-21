// Second 9 Labs — projects loader
// Reads projects.json and renders gallery or detail view depending on page

(function() {
  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  async function loadProjects() {
    try {
      const res = await fetch('projects.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Could not load projects.json (HTTP ' + res.status + ')');
      const data = await res.json();
      return data.projects || [];
    } catch (err) {
      console.error('projects.js:', err);
      return null;
    }
  }

  function renderGallery(projects, mount) {
    if (!projects) {
      mount.innerHTML = '<p class="gallery-loading">Couldn\'t load projects right now. Try refreshing the page.</p>';
      return;
    }
    if (projects.length === 0) {
      mount.innerHTML = '<p class="gallery-loading">No projects yet — we\'re just getting started.</p>';
      return;
    }

    mount.innerHTML = projects.map((p, i) => `
      <a class="project-card reveal" href="project.html?id=${encodeURIComponent(p.id)}" style="transition-delay: ${Math.min(i * 0.08, 0.4)}s">
        <div class="project-cover">
          <img src="${escapeHtml(p.cover)}" alt="" loading="lazy" />
        </div>
        <div class="project-body">
          <div class="project-meta">
            <span class="project-year">${escapeHtml(p.year || '')}</span>
            <span class="project-client">${escapeHtml(p.client || '')}</span>
          </div>
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.tagline)}</p>
          <div class="project-tags">
            ${(p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      </a>
    `).join('');

    // Trigger reveal animations
    requestAnimationFrame(() => {
      mount.querySelectorAll('.reveal').forEach(el => el.classList.add('on'));
    });
  }

  function renderDetail(projects, mount) {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!projects) {
      mount.innerHTML = '<p class="project-loading">Couldn\'t load this project. <a href="projects.html">Back to projects</a>.</p>';
      return;
    }

    const project = projects.find(p => p.id === id);
    if (!project) {
      mount.innerHTML = `
        <p class="eyebrow">Project not found</p>
        <h1>We couldn't find that one.</h1>
        <p class="lede">It might have been renamed or moved. Head back to the full list.</p>
        <a href="projects.html" class="btn btn-primary" style="margin-top: 2rem;">
          All projects <span class="btn-arrow">→</span>
        </a>
      `;
      document.title = 'Project not found — Second 9 Labs';
      return;
    }

    document.title = `${project.title} — Second 9 Labs`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', project.tagline);

    mount.innerHTML = `
      <a href="projects.html" class="back-link">← All projects</a>

      <div class="project-header">
        <p class="eyebrow">${escapeHtml(project.client)} · ${escapeHtml(project.year)}</p>
        <h1>${escapeHtml(project.title)}</h1>
        <p class="lede">${escapeHtml(project.tagline)}</p>
        <div class="project-tags">
          ${(project.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>

      <div class="project-hero-image">
        <img src="${escapeHtml(project.cover)}" alt="${escapeHtml(project.title)}" />
      </div>

      <div class="project-content">
        <div class="project-prose">
          <h2>What we built</h2>
          <p>${escapeHtml(project.description)}</p>

          ${project.outcome ? `
            <h2>What changed</h2>
            <p>${escapeHtml(project.outcome)}</p>
          ` : ''}
        </div>

        <aside class="project-sidebar">
          ${project.stack && project.stack.length ? `
            <div class="sidebar-block">
              <h4>Stack</h4>
              <ul>${project.stack.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${project.links && project.links.length ? `
            <div class="sidebar-block">
              <h4>Links</h4>
              <ul>${project.links.map(l => `
                <li><a href="${escapeHtml(l.url)}" ${l.url.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${escapeHtml(l.label)} →</a></li>
              `).join('')}</ul>
            </div>
          ` : ''}
        </aside>
      </div>

      ${project.images && project.images.length > 1 ? `
        <div class="project-gallery-grid">
          ${project.images.slice(1).map(img => `
            <div class="project-gallery-image">
              <img src="${escapeHtml(img)}" alt="" loading="lazy" />
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // Decide which page we're on and render accordingly
  document.addEventListener('DOMContentLoaded', async () => {
    const galleryMount = document.getElementById('gallery');
    const featuredMount = document.getElementById('featured-gallery');
    const detailMount = document.getElementById('project-root');

    if (!galleryMount && !featuredMount && !detailMount) return;
    const projects = await loadProjects();

    if (galleryMount) renderGallery(projects, galleryMount);
    if (featuredMount) {
      const featured = (projects || []).filter(p => p.featured).slice(0, 3);
      // Fall back to first 3 if none are flagged featured
      renderGallery(featured.length ? featured : (projects || []).slice(0, 3), featuredMount);
    }
    if (detailMount) {
      const wrap = detailMount.querySelector('.wrap');
      renderDetail(projects, wrap);
    }
  });
})();
