<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { Environment } from '@svx/di';
  import { RouterManager, FeatureRegistry } from '@svx/portal';
  import { SessionManager } from '@svx/security';

  const env             = getContext<Environment>('env');
  const routerManager   = env.get(RouterManager);
  const featureRegistry = env.get(FeatureRegistry);
  const sessionManager  = env.get(SessionManager);

  let session = $state(sessionManager.hasSession() ? sessionManager.currentSession() : null);
  let roles   = $derived(new Set<string>((session?.user.roles as string[]) ?? []));
  let features = $derived(
    featureRegistry.finder().withTag('navigation').matchesSession(!!session, roles).find()
  );

  onMount(() => {
    const sub = sessionManager.events$.subscribe(event => {
      if (event.type === 'opened') session = event.session;
      else if (event.type === 'closed') session = null;
    });
    return () => sub.unsubscribe();
  });

  // Icon map: tries to match feature.icon, falls back to a default
  const iconFallback = 'widgets';
  function icon(feature: any): string {
    return feature.icon ?? iconFallback;
  }

  function login() {
    const authMode = sessionStorage.getItem('svx:auth-mode') ?? 'oidc';
    if (authMode === 'credentials') {
      const loginFeature = featureRegistry.finder().withTag('login').findOptional();
      if (loginFeature?.router) {
        routerManager.navigate(('/' + loginFeature.router.path) as `/${string}`);
        return;
      }
    }
    sessionManager.openSession(undefined);
  }
</script>

<nav class="nav-drawer" aria-label="Main navigation">
  <div class="nav-items">
    {#each features as feature}
      {@const active = routerManager.isActive('/' + feature.router!.path)}
      <button
        class="nav-item"
        class:active
        onclick={() => routerManager.navigate('/' + feature.router!.path)}
        aria-current={active ? 'page' : undefined}
      >
        <span class="indicator">
          <span class="material-symbols-rounded nav-icon">
            {icon(feature)}
          </span>
        </span>
        <span class="nav-label">{feature.label}</span>
      </button>
    {/each}
  </div>

  <div class="nav-footer">
    {#if session}
      <div class="user-info">
        <span class="material-symbols-rounded nav-icon">account_circle</span>
        <span class="nav-label">{session.user.name || session.user.preferred_username}</span>
      </div>
      <button class="nav-item" onclick={async () => { await sessionManager.closeSession(); routerManager.navigate('/home'); }}>
        <span class="indicator">
          <span class="material-symbols-rounded nav-icon">logout</span>
        </span>
        <span class="nav-label">Logout</span>
      </button>
    {:else}
      <button class="nav-item" onclick={login}>
        <span class="indicator">
          <span class="material-symbols-rounded nav-icon">login</span>
        </span>
        <span class="nav-label">Login</span>
      </button>
    {/if}
  </div>
</nav>

<style>
  /* Import Material Symbols for icons */
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

  .nav-drawer {
    display: flex;
    flex-direction: column;
    width: 256px;
    height: 100%;
    background-color: var(--md-sys-color-surface);
    border-right: 1px solid var(--md-sys-color-outline-variant);
    padding: 12px 0;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Header ─────────────────────────────────── */
  .drawer-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px 24px;
  }

  /* ── Nav items container ─────────────────────── */
  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 12px;
  }

  /* ── Individual nav item ─────────────────────── */
  .nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 0 16px 0 0;
    border: none;
    background: transparent;
    border-radius: 28px;            /* M3 full-pill shape */
    cursor: pointer;
    text-align: left;
    color: var(--md-sys-color-on-surface-variant);
    transition:
      background-color 200ms ease,
      color             200ms ease;
    -webkit-tap-highlight-color: transparent;
    overflow: hidden;

    /* Ripple layer */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: currentColor;
      opacity: 0;
      transition: opacity 200ms ease;
    }

    &:hover::after  { opacity: 0.08; }
    &:active::after { opacity: 0.12; }
    &:focus-visible {
      outline: 3px solid var(--md-sys-color-primary);
      outline-offset: -1px;
    }
  }

  /* ── Active state ───────────────────────────── */
  .nav-item.active {
    color: var(--md-sys-color-on-secondary-container);
  }

  /* Active pill indicator behind the icon */
  .indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 32px;
    border-radius: 16px;
    flex-shrink: 0;
    transition: background-color 200ms ease;
  }

  .nav-item.active .indicator {
    background-color: var(--md-sys-color-secondary-container);
  }

  /* ── Icon ───────────────────────────────────── */
  .nav-icon {
    font-family: 'Material Symbols Rounded';
    font-size: 24px;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    transition: font-variation-settings 200ms ease;
    user-select: none;
    line-height: 1;
  }

  .nav-item.active .nav-icon {
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }

  /* ── Footer ─────────────────────────────────── */
  .nav-footer {
    margin-top: auto;
    padding: 12px 12px 0;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 16px 0 0;
    color: var(--md-sys-color-on-surface-variant);
  }

  .user-info .nav-icon {
    width: 56px;
    flex-shrink: 0;
    text-align: center;
  }

  /* ── Label ──────────────────────────────────── */
  .nav-label {
    font-family: var(--md-sys-typescale-label-large-font, system-ui);
    font-size: var(--md-sys-typescale-label-large-size, 0.875rem);
    font-weight: 600;
    letter-spacing: 0.006em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
