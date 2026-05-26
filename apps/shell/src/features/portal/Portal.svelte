<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'portal',
      label:       'Portal',
      permissions: [],
      visibility: ["public", "private"],
      tags:        ['portal'],
    },
    () => import('./Portal.svelte')
  );
</script>

<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { Router } from 'sv-router';

  import { Environment } from '@svx/di';
  import { FeatureRegistry, RouterManager } from '@svx/portal';

  import Navigation from './Navigation.svelte';

  const env           = getContext<Environment>('env');
  const registry      = env.get(FeatureRegistry);
  const routerManager = env.get(RouterManager);

  const authMode    = sessionStorage.getItem('svx:auth-mode') ?? 'oidc';
  const switchUrl   = authMode === 'credentials' ? '/?auth=oidc' : '/?auth=credentials';
  const switchLabel = authMode === 'credentials' ? 'Switch to OIDC' : 'Switch to Credentials';

  onMount(async () => {
    // Wait a tick so lazy features can register their routes first
    await Promise.resolve();
    if (window.location.pathname === '/') {
      void routerManager.navigate('/home');
    }
  });
</script>

<div class="portal">

 <header class="portal-header">
     <div class="portal-logo">
       <span class="material-symbols-rounded logo-icon">hub</span>
       <span class="logo-text">Portal</span>
     </div>
     <div class="portal-header-actions">
       <span class="auth-mode-badge">{authMode}</span>
       <button class="auth-switch-link" onclick={() => window.location.assign(switchUrl)}>{switchLabel}</button>
     </div>
   </header>

  <div class="portal-body">

    <aside class="portal-sidebar">
      <Navigation />
    </aside>

    <main class="portal-main">
      <Router />
    </main>

  </div>

  <footer class="portal-footer">
      <span class="material-symbols-rounded footer-icon">hub</span>
      <span>Portal · © 2026</span>
    </footer>

</div>

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
    padding: 0;
  }

  .portal {
    display: grid;
    grid-template-rows: 56px 1fr 40px;   /* explicit heights, no auto collapse */
    height: 100vh;
    overflow: hidden;
  }

  /* ── Header ───────────────────────────────────────────── */
  .portal-header {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);

    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    height: 56px;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    z-index: 10;
  }

  .portal-logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon {
    font-family: 'Material Symbols Rounded';
    font-size: 26px;
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    color: var(--md-sys-color-on-primary);
    line-height: 1;
  }

  .logo-text {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--md-sys-color-on-primary);
      letter-spacing: 0.02em;
  }

  /* ── Body ─────────────────────────────────────────────── */
  .portal-body {
    display: grid;
    grid-template-columns: 220px 1fr;
    overflow: hidden;
    min-height: 0;                        /* prevents grid blowout */
  }

  /* ── Sidebar ──────────────────────────────────────────── */
  .portal-sidebar {
    overflow-y: auto;
    border-right: 1px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-surface-container);
  }

  /* ── Main ─────────────────────────────────────────────── */
  .portal-main {
    overflow-y: auto;
    padding: 1.5rem;
    min-height: 0;
    background: var(--md-sys-color-surface-container-lowest);
  }

  /* ── Footer ───────────────────────────────────────────── */
  .portal-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 1.5rem;
    height: 40px;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    background: var(--md-sys-color-primary);
    color: white;
  }

  .footer-icon {
      font-family: 'Material Symbols Rounded';
      font-size: 16px;
      font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 16;
      color: white;
      opacity: 0.7;
      line-height: 1;
    }

  /* ── Auth mode indicator ─────────────────────────────────── */
  .portal-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .auth-mode-badge {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.2);
    color: var(--md-sys-color-on-primary);
  }

  .auth-switch-link {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--md-sys-color-on-primary);
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 999px;
    padding: 4px 12px;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;
  }

  .auth-switch-link:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.9);
  }
</style>
