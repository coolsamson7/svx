import { view, requestConfluence as forgeRequest } from '@forge/bridge'

export interface MacroConfig {
  gitlabUrl?: string;
  attachmentName?: string;
  readonly?: boolean;
  height?: number;
}

export interface ForgeContext {
  pageId: string;
  spaceKey: string;
  config: MacroConfig;
}

const DEV_CONTEXT: ForgeContext = {
  pageId:   'dev-page-id',
  spaceKey: 'DEV',
  config: {
    gitlabUrl:      import.meta.env.VITE_DEV_GITLAB_URL ?? '/model.xmi',
    attachmentName: undefined,
    readonly:       false,
    height:         600,
  },
};

export async function getForgeContext(): Promise<ForgeContext> {
  if (import.meta.env.DEV) return DEV_CONTEXT;

  await view.emitReadyEvent();
  const ctx = await view.getContext();

  return {
    pageId:   ctx.extension.content?.id ?? '',
    spaceKey: ctx.extension.space?.key ?? '',
    config: {
      gitlabUrl:      (ctx.extension as any).config?.gitlabUrl,
      attachmentName: (ctx.extension as any).config?.attachmentName ?? 'model.xmi',
      readonly:       (ctx.extension as any).config?.readonly === 'true',
      height:         Number((ctx.extension as any).config?.height ?? 600),
    },
  };
}

export async function requestConfluence(path: string, init?: RequestInit): Promise<Response> {
  if (import.meta.env.DEV) {
    return fetch(`https://coolsamson.atlassian.net/wiki${path}`, init);
  }
  return forgeRequest(path, init) as Promise<Response>;
}
