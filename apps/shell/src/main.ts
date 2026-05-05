import 'reflect-metadata'

import { ConsoleTrace, Environment, TraceLevel, Tracer, module, onRunning, Module, FeatureRegistry} from "@svx/portal"

import { mount } from 'svelte';

new Tracer({
      enabled: true,
      trace: new ConsoleTrace('%d [%p]: %m\n'), // %f
      paths: {
        di: TraceLevel.FULL,
        router: TraceLevel.FULL,
        portal: TraceLevel.FULL,
        application: TraceLevel.FULL
      }
});

// main module

@module()
class ApplicationModule extends Module {
  // lifecycle

  @onRunning()
  async setup() : Promise<void> {
    console.log("ApplicationModule.setup")
  }
}

// start environment

const environment = new Environment({module: ApplicationModule})
await environment.start()

// load local and remote manifests

const registry = environment.get(FeatureRegistry);

await registry.loadManifests(
  '/manifest.json',
  //'http://localhost:4201/manifest.json'
);

// force loading of local components

await registry.bootComponents(import.meta.glob('./features/**/*.svelte')); // maybe subfolder is better

// report

console.log(environment.report())

// mount app

import './main.css';

const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: {
    environment
  }
});
