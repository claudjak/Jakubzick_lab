/* Shared header/footer, header scroll state, mobile nav, active link, scroll reveals, analytics beacon. */
(function () {
  const C = window.JLAB_CONFIG || {};
  const header = `<header class="site-header solid"><div class="wrap">
    <a class="brand" href="./"><span class="brand-mark" aria-hidden="true"><img src="assets/logo-mark.png" alt="" width="26" height="26"></span><span><b>Jakubzick</b> Lab</span></a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav"><span></span></button>
    <nav class="nav" id="nav" aria-label="Main">
      <a href="research.html">Research</a>
      <a href="people.html">People</a>
      <a href="publications.html">Publications</a>
      <a href="news.html">News</a>
      <div class="menu"><a href="network.html" class="menu-btn" aria-haspopup="true" aria-expanded="false">Explore ▾</a>
        <div class="menu-list"><a href="network.html">Collaborator network</a><a href="bibliometrics.html">Bibliometrics</a><a href="about.html">About this site</a></div></div>
      <a href="join.html">Join us</a>
    </nav></div></header>`;
  const footer = `<footer class="site-footer"><div class="wrap">
    <div><strong>Jakubzick Laboratory</strong>Department of Microbiology and Immunology, Geisel School of Medicine at Dartmouth. Directed by Claudia Jakubzick. We study mononuclear phagocytes—macrophages, monocytes and dendritic cells—in homeostasis, inflammation and cancer, and the role of natural antibodies in cancer immune surveillance. <span id="foot-updated"></span></div>
    <div><strong>Lab</strong><ul><li><a href="research.html">Research</a></li><li><a href="people.html">People</a></li><li><a href="publications.html">Publications</a></li><li><a href="news.html">News</a></li><li><a href="join.html">Join us / contact</a></li><li><a href="about.html">About this site</a></li><li><a href="feed.xml">RSS: new papers</a></li></ul></div>
    <div><strong>Elsewhere</strong><ul><li><a href="https://geiselmed.dartmouth.edu/microbiology/" target="_blank" rel="noopener">Microbiology &amp; Immunology at Geisel</a></li><li><a href="https://scholar.google.com/citations?user=Cqas744AAAAJ" target="_blank" rel="noopener">Google Scholar</a></li><li><a href="https://pubmed.ncbi.nlm.nih.gov/?term=Jakubzick+C%5BAuthor%5D" target="_blank" rel="noopener">PubMed</a></li><li><a href="https://www.immgen.org/" target="_blank" rel="noopener">Immunological Genome Project</a></li><li><a href="https://github.com/${C.repo || "claudjak/Jakubzick_lab"}" target="_blank" rel="noopener">This site's source &amp; data</a></li></ul></div>
    <div class="credit-row"><span class="credit">Jakubzick Laboratory · Geisel School of Medicine at Dartmouth · Lebanon, NH · Site design by <a href="https://torwager.github.io" target="_blank" rel="noopener">Tor Wager</a></span></div>
  </div></footer>`;
  const h = document.getElementById("site-header"); if (h) h.outerHTML = header;
  const f = document.getElementById("site-footer"); if (f) f.outerHTML = footer;

  const hdr = document.querySelector(".site-header");
  const onScroll = () => hdr && hdr.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  if (window.CL) CL.updateListBadge();
  // "My list" lives in the footer: mirror the star count there
  const here = (location.pathname.split("/").pop() || "index.html");
  document.querySelectorAll(".nav a").forEach(a => { if (a.getAttribute("href") === here) a.classList.add("active"); });
  if (here.startsWith("paper")) document.querySelectorAll('.nav a[href="publications.html"]').forEach(a => a.classList.add("active"));

  const toggle = document.querySelector(".nav-toggle"), nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => { const open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); });
    nav.addEventListener("click", e => { if (e.target.tagName === "A" && !e.target.classList.contains("menu-btn")) nav.classList.remove("open"); });
  }
  document.querySelectorAll(".menu-btn").forEach(b => b.addEventListener("click", e => { const m = b.parentElement; if (!m.classList.contains("open") && window.matchMedia("(hover: none)").matches) { e.preventDefault(); m.classList.add("open"); b.setAttribute("aria-expanded", "true"); } }));

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rvs = document.querySelectorAll(".rv");
  if (reduce || !("IntersectionObserver" in window)) { rvs.forEach(el => el.classList.add("in")); }
  else { const io = new IntersectionObserver(entries => { entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { threshold: 0.12 }); rvs.forEach(el => io.observe(el)); }

  // Cookie-free analytics (Cloudflare Web Analytics) once a token is configured
  if (C.cfAnalyticsToken) { const s = document.createElement("script"); s.defer = true; s.src = "https://static.cloudflareinsights.com/beacon.min.js"; s.setAttribute("data-cf-beacon", JSON.stringify({ token: C.cfAnalyticsToken })); document.head.appendChild(s); }
})();
