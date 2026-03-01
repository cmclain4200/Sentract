import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Shield, Search, Building2, BarChart3, Scale, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import "./Landing.css";

function useScrollReveal(containerRef, ready = true) {
  useEffect(() => {
    if (!ready) return;
    const el = containerRef.current;
    if (!el) return;
    const targets = el.querySelectorAll(".l-reveal");

    if (!("IntersectionObserver" in window)) {
      targets.forEach((t) => t.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add("visible"), i * 80);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((t) => observer.observe(t));

    // Safety net: force-show anything still hidden after 3s
    const timeout = setTimeout(() => {
      el.querySelectorAll(".l-reveal:not(.visible)").forEach((t) => {
        t.classList.add("visible");
      });
    }, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [containerRef, ready]);
}

export default function Landing() {
  const { user, loading } = useAuth();
  const containerRef = useRef(null);
  const [navScrolled, setNavScrolled] = useState(false);

  useScrollReveal(containerRef, !loading);

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing" ref={containerRef}>
      {/* ── NAV ── */}
      <nav className={`l-nav${navScrolled ? " scrolled" : ""}`}>
        <div className="l-nav-inner">
          <a href="#" className="l-nav-logo">
            <img src="/sentract-logo-dark.png" alt="Sentract" />
          </a>
          <div className="l-nav-links">
            <a href="#features">Features</a>
            <a href="#security">Security</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="l-nav-actions">
            <Link to="/login" className="l-btn-ghost">Sign In</Link>
            <Link to="/signup" className="l-btn-primary">Request Access <span>→</span></Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="l-hero">
        <div className="l-container">
          <div className="l-hero-inner">
            <div className="l-hero-text">
              <div className="cat-label">The Intelligence Analysis Platform</div>
              <h1>Turn Investigation Data Into <em>Adversarial</em> Intelligence</h1>
              <p className="l-hero-sub">
                Upload an investigation report. Get an adversarial threat assessment,
                quantified risk score, and behavioral pattern analysis in minutes — not days.
              </p>
              <div className="l-hero-actions">
                <Link to="/signup" className="l-btn-primary l-btn-primary-lg">
                  Request Early Access <span>→</span>
                </Link>
                <a href="#features" className="l-btn-ghost l-btn-ghost-lg">
                  See How It Works ↓
                </a>
              </div>
            </div>

            {/* Product Mockup */}
            <div className="l-hero-mockup">
              <div className="l-mockup-card">
                <div className="l-mockup-header">
                  <div className="l-mockup-title">⬡ Aegis Score — MERCER-2026-001</div>
                  <div className="l-mockup-badge">High Risk</div>
                </div>
                <div className="l-mockup-score-area">
                  <div className="l-score-circle">
                    <div className="l-score-circle-inner">
                      <div className="l-score-num">74</div>
                      <div className="l-score-label">/100</div>
                    </div>
                  </div>
                  <div className="l-score-factors">
                    {[
                      { name: "Digital", val: 82 },
                      { name: "Breach", val: 71 },
                      { name: "Behavioral", val: 89 },
                      { name: "Physical", val: 54 },
                      { name: "Network", val: 65 },
                    ].map((f) => (
                      <div className="l-factor-row" key={f.name}>
                        <span className="l-factor-name">{f.name}</span>
                        <div className="l-factor-bar">
                          <div className="l-factor-fill" style={{ width: `${f.val}%` }} />
                        </div>
                        <span className="l-factor-val">{f.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="l-mockup-map">
                  <div className="l-mockup-map-label">Recon Mirror — Phase 2: Approach</div>
                  <div className="l-map-dot" style={{ top: "30%", left: "25%", background: "var(--accent)" }} />
                  <div className="l-map-dot" style={{ top: "55%", left: "60%", background: "var(--warning)" }} />
                  <div className="l-map-dot" style={{ top: "40%", left: "78%", background: "var(--critical)" }} />
                  <div className="l-map-line" style={{ top: "35%", left: "28%", width: 100, background: "var(--accent)", transform: "rotate(12deg)" }} />
                  <div className="l-map-line" style={{ top: "50%", left: "63%", width: 60, background: "var(--warning)", transform: "rotate(-15deg)" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── METRICS BAR ── */}
      <div className="l-metrics-bar">
        <div className="l-container">
          <div className="l-metrics-inner">
            <span>4 Intelligence Modules</span>
            <span className="l-metric-dot" />
            <span>Breach Enrichment via HIBP</span>
            <span className="l-metric-dot" />
            <span>Geospatial Threat Mapping</span>
            <span className="l-metric-dot" />
            <span>Zero Data Retention on AI</span>
          </div>
        </div>
      </div>

      {/* ── PROBLEM SECTION ── */}
      <section className="l-section" id="problem">
        <div className="l-container">
          <div className="l-section-header l-reveal">
            <div className="cat-label">Why This Exists</div>
            <div className="l-section-title">
              Investigation Platforms Find Data.<br />Nobody Thinks Like the Threat.
            </div>
          </div>
          <div className="l-problem-grid">
            <div className="l-problem-prose l-reveal">
              <p>
                OSINT tools collect social media profiles, breach records, public filings,
                and entity relationships. They're excellent at assembling data. But when
                the data is assembled, the hardest question remains unanswered: what does
                this exposure actually mean?
              </p>
              <p>
                Today, that analysis happens manually. An analyst stares at the collected
                data, tries to think like an adversary, and writes up their assessment in
                a Word document. That manual analysis step is the bottleneck — it's where
                the real expertise lives, the most value is created, and where no existing
                software helps.
              </p>
            </div>
            <div className="l-problem-stats l-reveal">
              <div>
                <div className="l-stat-number">6–9 hrs</div>
                <div className="l-stat-desc">
                  Manual analysis time per investigation — the step between data collection
                  and client deliverable
                </div>
              </div>
              <div>
                <div className="l-stat-number">$1,200+</div>
                <div className="l-stat-desc">
                  Analyst cost per threat assessment at typical billing rates
                </div>
              </div>
              <div>
                <div className="l-stat-number">0</div>
                <div className="l-stat-desc">
                  Tools that reason adversarially about investigation data
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── FEATURES ── */}
      <section className="l-section" id="features">
        <div className="l-container">
          <div className="l-section-header l-reveal">
            <div className="cat-label">Intelligence Modules</div>
            <div className="l-section-title">
              Four Layers of Analysis.<br />One Structured Profile.
            </div>
          </div>

          {/* 2×2 feature grid */}
          <div className="l-features-grid-2x2 l-reveal">
            {/* RECON MIRROR */}
            <div className="l-feature-card">
              <div className="l-feature-visual" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
                <div className="l-mini-map" style={{ flex: 1 }}>
                  <div style={{ position: "absolute", top: 8, left: 10, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6 }}>
                    Recon Mirror
                  </div>
                  {/* Dots spread across full visual area */}
                  <div className="l-map-dot" style={{ top: "30%", left: "15%", background: "var(--accent)" }} />
                  <div className="l-map-dot" style={{ top: "60%", left: "25%", background: "var(--accent)" }} />
                  <div className="l-map-dot" style={{ top: "70%", left: "50%", background: "var(--warning)" }} />
                  <div className="l-map-dot" style={{ top: "40%", left: "75%", background: "var(--critical)" }} />
                  <div className="l-map-dot" style={{ top: "85%", left: "65%", background: "var(--accent)" }} />
                  {/* Lines connecting dots 1→2→3→4 */}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                    <line x1="15%" y1="30%" x2="25%" y2="60%" stroke="#00d4aa" strokeWidth="1.5" opacity="0.4" />
                    <line x1="25%" y1="60%" x2="50%" y2="70%" stroke="#00d4aa" strokeWidth="1.5" opacity="0.4" />
                    <line x1="50%" y1="70%" x2="75%" y2="40%" stroke="#00d4aa" strokeWidth="1.5" opacity="0.4" />
                  </svg>
                  <div style={{ position: "absolute", bottom: 12, left: 10, right: 10 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "#00d4aa", opacity: 0.8, marginBottom: 4 }}>PHASE 2 — APPROACH VECTOR</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>Subject departs primary residence at 0615 via established route toward Marina Green waterfront...</div>
                  </div>
                </div>
              </div>
              <div className="l-feature-content">
                <div className="l-feature-subtitle">Adversarial Threat Assessment</div>
                <div className="l-feature-name">Recon Mirror</div>
                <div className="l-feature-desc">
                  AI generates tactically specific scenarios showing how a threat actor would
                  exploit the subject's data — mapped across real geography with phase-by-phase
                  visualization. Every vulnerability paired with a countermeasure.
                </div>
              </div>
            </div>

            {/* AEGIS SCORE */}
            <div className="l-feature-card">
              <div className="l-feature-visual" style={{ padding: 20 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6, marginBottom: 14 }}>
                  Aegis Score
                </div>
                <div className="l-mini-score-wrap">
                  <div className="l-mini-score">
                    <div className="l-mini-score-inner">
                      <div className="l-mini-score-num">74</div>
                      <div className="l-mini-score-label">/ 100</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--critical)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    High Risk<br />
                    <span style={{ color: "var(--text-muted)", fontSize: 8 }}>Previous: 68 · ▲ +6</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    { label: "Digital", val: 82 },
                    { label: "Breach", val: 71 },
                    { label: "Behavioral", val: 89 },
                    { label: "Physical", val: 54 },
                    { label: "Network", val: 65 },
                  ].map((b) => (
                    <div className="l-mini-bar" key={b.label}>
                      <span className="l-mini-bar-label">{b.label}</span>
                      <div className="l-mini-bar-track">
                        <div className="l-mini-bar-fill" style={{ width: `${b.val}%` }} />
                      </div>
                      <span className="l-mini-bar-val">{b.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="l-feature-content">
                <div className="l-feature-subtitle">Quantified Exploitability Index</div>
                <div className="l-feature-name">Aegis Score</div>
                <div className="l-feature-desc">
                  0–100 risk score with five weighted factors. Dynamic remediation simulation —
                  toggle protective actions and watch the score recalculate in real time. Track
                  changes between assessments.
                </div>
              </div>
            </div>

            {/* PATTERN LENS */}
            <div className="l-feature-card">
              <div className="l-feature-visual" style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6, marginBottom: 20 }}>
                  Pattern Lens
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>Morning Run</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--warning)", background: "rgba(245,158,11,0.1)", padding: "2px 6px", borderRadius: 2, border: "1px solid rgba(245,158,11,0.2)" }}>HIGH</div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", marginBottom: 6 }}>CONSISTENCY</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: "89%", height: "100%", background: "var(--accent)", borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff" }}>89%</span>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", marginBottom: 8 }}>WEEKLY HEATMAP</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    "rgba(9,188,138,0.75)", "rgba(9,188,138,0.5)", "rgba(9,188,138,0.75)", "rgba(9,188,138,0.3)",
                    "rgba(9,188,138,0.75)", "rgba(9,188,138,0.15)", "#1a1a1a",
                  ].map((bg, i) => (
                    <div key={i} style={{ width: 28, height: 28, borderRadius: 3, background: bg }} />
                  ))}
                </div>
              </div>
              <div className="l-feature-content">
                <div className="l-feature-subtitle">Behavioral Pattern Extraction</div>
                <div className="l-feature-name">Pattern Lens</div>
                <div className="l-feature-desc">
                  Transforms scattered observations into structured threat intelligence.
                  Routine consistency scoring identifies exploitable schedules with precision timing.
                </div>
              </div>
            </div>

            {/* CROSSWIRE */}
            <div className="l-feature-card">
              <div className="l-feature-visual" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "stretch" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.6, marginBottom: 20 }}>
                  CrossWire
                </div>
                <div className="l-mini-entity" style={{ marginBottom: 28 }}>
                  <div className="l-entity-node" style={{ width: 44, height: 44, fontSize: 11 }}>JRM</div>
                  <div className="l-entity-line">
                    <div className="l-entity-badge" style={{ fontSize: 9, padding: "3px 8px", background: "rgba(0,212,170,0.15)", border: "1px solid rgba(0,212,170,0.3)", borderRadius: 3 }}>SHARED BREACH</div>
                  </div>
                  <div className="l-entity-node" style={{ width: 44, height: 44, fontSize: 11 }}>DKC</div>
                </div>
                <div className="l-mini-entity">
                  <div className="l-entity-node" style={{ width: 44, height: 44, fontSize: 11 }}>JRM</div>
                  <div className="l-entity-line">
                    <div className="l-entity-badge" style={{ fontSize: 9, padding: "3px 8px", background: "rgba(0,212,170,0.15)", border: "1px solid rgba(0,212,170,0.3)", borderRadius: 3 }}>COMMON ASSOCIATE</div>
                  </div>
                  <div className="l-entity-node" style={{ width: 44, height: 44, fontSize: 11 }}>TLW</div>
                </div>
              </div>
              <div className="l-feature-content">
                <div className="l-feature-subtitle">Cross-Case Intelligence</div>
                <div className="l-feature-name">CrossWire</div>
                <div className="l-feature-desc">
                  Automatic detection of shared entities across investigations — overlapping
                  breaches, common associates, shared data brokers. Organizational vulnerabilities
                  that case-by-case analysis would miss.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── WORKFLOW ── */}
      <section className="l-section">
        <div className="l-container">
          <div className="l-section-header l-reveal">
            <div className="cat-label">The Workflow</div>
            <div className="l-section-title">From Raw Data to Actionable Intelligence</div>
          </div>
          <div className="l-workflow-steps l-reveal">
            {[
              { num: 1, title: "Input", desc: "Enter findings manually or upload an existing report. AI auto-extracts into a structured profile." },
              { num: 2, title: "Enrich", desc: "One-click breach lookups, address geocoding, company verification, data broker checks." },
              { num: 3, title: "Analyze", desc: "Run adversarial assessments, calculate risk scores, extract behavioral patterns, detect cross-case links." },
              { num: 4, title: "Deliver", desc: "Export audience-specific deliverables — executive summaries, detailed assessments, quantified risk reports." },
            ].map((s) => (
              <div className="l-workflow-step" key={s.num}>
                <div className="l-step-num">{s.num}</div>
                <div className="l-step-title">{s.title}</div>
                <div className="l-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── USE CASES ── */}
      <section className="l-section">
        <div className="l-container">
          <div className="l-section-header l-reveal">
            <div className="cat-label">Built for Security Professionals</div>
            <div className="l-section-title">Sentract Adapts to Your Case Type</div>
          </div>
          <div className="l-usecase-grid l-reveal">
            {[
              { icon: <Shield size={24} strokeWidth={1.5} color="#00d4aa" />, name: "Executive Protection", desc: "Threat assessments for high-profile clients" },
              { icon: <Search size={24} strokeWidth={1.5} color="#00d4aa" />, name: "Due Diligence", desc: "Risk profiles for M&A and hiring decisions" },
              { icon: <Building2 size={24} strokeWidth={1.5} color="#00d4aa" />, name: "Corporate Security", desc: "Board-ready metrics and C-suite risk analysis" },
              { icon: <BarChart3 size={24} strokeWidth={1.5} color="#00d4aa" />, name: "Insurance Risk", desc: "Quantified exposure for K&R and cyber underwriting" },
              { icon: <Scale size={24} strokeWidth={1.5} color="#00d4aa" />, name: "Legal Investigation", desc: "Traceable analysis for litigation support" },
            ].map((u) => (
              <div className="l-usecase-card" key={u.name}>
                <div className="l-usecase-icon">{u.icon}</div>
                <div className="l-usecase-name">{u.name}</div>
                <div className="l-usecase-desc">{u.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── SECURITY ── */}
      <section className="l-section" id="security">
        <div className="l-container">
          <div className="l-section-header l-reveal">
            <div className="cat-label">Data Security</div>
            <div className="l-section-title">Your Intelligence Data. Protected.</div>
          </div>
          <div className="l-security-grid l-reveal">
            <div>
              <div className="l-security-icon"><Lock size={24} strokeWidth={1.5} color="#00d4aa" /></div>
              <div className="l-security-title">Encryption & Isolation</div>
              <div className="l-security-desc">
                All data encrypted in transit (TLS) and at rest. Per-user isolation via
                row-level security policies. Your investigation data is invisible to other
                users at the database level.
              </div>
            </div>
            <div>
              <div className="l-security-icon"><ShieldCheck size={24} strokeWidth={1.5} color="#00d4aa" /></div>
              <div className="l-security-title">Zero AI Training</div>
              <div className="l-security-desc">
                Investigation data sent to AI models is never retained or used for training.
                Built on Anthropic's API with a zero-retention policy. Your intelligence stays yours.
              </div>
            </div>
            <div>
              <div className="l-security-icon"><Trash2 size={24} strokeWidth={1.5} color="#00d4aa" /></div>
              <div className="l-security-title">Minimal Retention</div>
              <div className="l-security-desc">
                Uploaded documents are processed and discarded. Only structured profiles and
                generated outputs persist. Full deletion available at any time. You control the data lifecycle.
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── PRICING ── */}
      <section className="l-section" id="pricing">
        <div className="l-container">
          <div className="l-section-header l-reveal">
            <div className="cat-label">Pricing</div>
            <div className="l-section-title">Simple Plans. Serious Analysis.</div>
          </div>
          <div className="l-pricing-grid l-reveal">
            {/* Starter */}
            <div className="l-pricing-card">
              <div className="l-pricing-plan">Starter</div>
              <div className="l-pricing-price">$199</div>
              <div className="l-pricing-period">per month</div>
              <ul className="l-pricing-features">
                <li>5 active cases</li>
                <li>10 AI assessments / month</li>
                <li>All 4 intelligence modules</li>
                <li>Single user</li>
                <li>Email support</li>
              </ul>
              <Link to="/signup" className="l-btn-ghost l-pricing-cta">Get Started →</Link>
            </div>

            {/* Professional (featured) */}
            <div className="l-pricing-card featured">
              <div className="l-pricing-popular">Most Popular</div>
              <div className="l-pricing-plan">Professional</div>
              <div className="l-pricing-price">$499</div>
              <div className="l-pricing-period">per month</div>
              <ul className="l-pricing-features">
                <li>25 active cases</li>
                <li>50 assessments / month</li>
                <li>Report auto-extract</li>
                <li>Breach enrichment (HIBP)</li>
                <li>Up to 3 team members</li>
                <li>Priority support</li>
              </ul>
              <Link to="/signup" className="l-btn-primary l-pricing-cta">Get Started →</Link>
            </div>

            {/* Enterprise */}
            <div className="l-pricing-card">
              <div className="l-pricing-plan">Enterprise</div>
              <div className="l-pricing-price">Custom</div>
              <div className="l-pricing-period">tailored to your team</div>
              <ul className="l-pricing-features">
                <li>Unlimited cases & assessments</li>
                <li>Priority API access</li>
                <li>Custom report templates</li>
                <li>Full team access + RBAC</li>
                <li>Dedicated support</li>
                <li>API for integrations</li>
              </ul>
              <a href="mailto:cole@sentract.com" className="l-btn-ghost l-pricing-cta">Contact Sales →</a>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── BOTTOM CTA ── */}
      <section className="l-bottom-cta" id="contact">
        <div className="l-container">
          <h2 className="l-reveal">Turn Investigation Output<br />Into Intelligence</h2>
          <Link to="/signup" className="l-btn-primary l-btn-primary-lg l-reveal">
            Request Early Access <span>→</span>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="l-footer">
        <div className="l-container">
          <div className="l-footer-grid">
            <div>
              <div className="l-footer-brand-name">
                <img src="/sentract-logo-dark.png" alt="Sentract" />
              </div>
              <div className="l-footer-tagline">
                Intelligence analysis platform for security professionals. From investigation
                data to adversarial intelligence.
              </div>
            </div>
            <div className="l-footer-col">
              <div className="l-footer-col-title">Product</div>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#security">Security</a>
              <a href="#">Documentation</a>
            </div>
            <div className="l-footer-col">
              <div className="l-footer-col-title">Company</div>
              <a href="#">About</a>
              <a href="#">Careers</a>
              <a href="mailto:cole@sentract.com">Contact</a>
              <a href="#">Blog</a>
            </div>
            <div className="l-footer-col">
              <div className="l-footer-col-title">Legal</div>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Acceptable Use</a>
            </div>
          </div>
          <div className="l-footer-bottom">
            © 2026 Sentract. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
