<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'login',
      label:       'Login',
      router:      { path: 'login' },
      permissions: [],
      visibility:  ['public'],
      tags:        ['login'],
    },
    () => import('./Login.svelte')
  );
</script>

<script lang="ts">
  import { getContext } from 'svelte';
  import { Environment } from '@svx/di';
  import { SessionManager } from '@svx/security';
  import { RouterManager } from '@svx/portal';

  const env            = getContext<Environment>('env');
  const sessionManager = env.get(SessionManager);
  const routerManager  = env.get(RouterManager);

  let username = $state('');
  let password = $state('');
  let error    = $state('');
  let loading  = $state(false);

  async function submit() {
    loading = true;
    error   = '';
    try {
      await sessionManager.openSession({ username, password });
      if (sessionStorage.getItem('redirect_after_login')) {
        routerManager.navigateAfterLogin();
      } else {
        routerManager.navigate('/home');
      }
    } catch (e: any) {
      error = e.message ?? 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-card">
    <span class="material-symbols-rounded card-icon">lock</span>
    <h2>Sign in</h2>

    <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
      <label>
        Username
        <input type="text" bind:value={username} autocomplete="username" required />
      </label>

      <label>
        Password
        <input type="password" bind:value={password} autocomplete="current-password" required />
      </label>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </div>
</div>

<style>
  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .login-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2.5rem 2rem;
    border-radius: 16px;
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    width: 320px;
  }

  .card-icon {
    font-family: 'Material Symbols Rounded';
    font-size: 48px;
    font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48;
    color: var(--md-sys-color-primary);
  }

  h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface-variant);
  }

  input {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--md-sys-color-outline);
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    font-size: 0.95rem;
    outline: none;
    transition: border-color 150ms;
  }

  input:focus {
    border-color: var(--md-sys-color-primary);
  }

  .error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--md-sys-color-error);
  }

  button {
    margin-top: 0.5rem;
    padding: 12px;
    border-radius: 8px;
    border: none;
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 150ms;
  }

  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
