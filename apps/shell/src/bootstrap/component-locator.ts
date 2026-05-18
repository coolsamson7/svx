import { Component, ComponentDescriptor } from '@svx/service-common';
import { ComponentLocator, ServiceInstanceProvider } from '@svx/service-client';
import { injectable } from '@svx/di';

@injectable()
export class StaticComponentLocator extends ComponentLocator {
  locate(_component: ComponentDescriptor<Component>): string {
    return import.meta.env.VITE_API_URL;
  }
}

ServiceInstanceProvider.registerServiceProviders();
