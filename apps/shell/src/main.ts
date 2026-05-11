import 'reflect-metadata'

import { Component, ConsoleTrace, Environment, TraceLevel, Tracer, module, onRunning, Module, FeatureRegistry, Providers, ServiceClient, injectable, ComponentLocator, ComponentDescriptor, ServiceRegistry, ServiceInstanceProvider} from "@svx/portal"

import { mount } from 'svelte';

const c = UserInventoryComponent

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

@injectable()
export class StaticComponentLocator extends ComponentLocator {
  // implement

  locate(_component: ComponentDescriptor<Component>): string {
    return "http://localhost:3000"
  }
}

// NEW

Providers.registerClass('', RestChannel, true)
//Providers.registerClass('', ServiceClient, true)

ServiceInstanceProvider.registerServiceProviders()

// NEW

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
import { UserInventoryComponent } from './features/users/user-inventory.service';

const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: {
    environment
  }
});
