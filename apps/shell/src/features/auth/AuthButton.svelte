<script lang="ts">
  import { getContext } from 'svelte';
  import { Environment } from '@svx/di';
  import { AuthService } from '@svx/auth';
  import { authState } from './auth.store.svelte';

  const env         = getContext<Environment>('env');
  const authService = env.get(AuthService);
</script>

{#if authState.isLoading}
  <span class="auth-loading">…</span>
{:else if authState.authenticated}
  <span class="auth-user">{authState.username}</span>
  <button class="auth-btn" onclick={() => authService.logout()}>Logout</button>
{:else}
  <button class="auth-btn" onclick={() => authService.login()}>Login</button>
{/if}

<style>
  .auth-user {
    font-size: 0.875rem;
    color: var(--md-sys-color-on-primary);
    opacity: 0.9;
  }

  .auth-btn {
    padding: 6px 16px;
    border: 1px solid var(--md-sys-color-on-primary);
    border-radius: 20px;
    background: transparent;
    color: var(--md-sys-color-on-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 150ms ease;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }

  .auth-loading {
    color: var(--md-sys-color-on-primary);
    opacity: 0.6;
  }
</style>
