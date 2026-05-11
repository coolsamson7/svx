import 'reflect-metadata'

import {  ConsoleTrace, TraceLevel, Tracer } from "@svx/common"

import {  Environment, module, onRunning, Module, injectable } from "@svx/di"

import { Component, ComponentDescriptor} from "@svx/service-common"
import { ComponentLocator, ServiceInstanceProvider} from "@svx/service-client"

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

//TODO Providers.registerClass('', RestChannel, true)
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
import { FeatureRegistry } from '@svx/portal';

const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: {
    environment
  }
});
