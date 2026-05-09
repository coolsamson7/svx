// =========================================
// transport/http.transport.ts
// =========================================

import {
  Body,
  Controller,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import {
  plainToInstance,
  instanceToPlain,
} from 'class-transformer';

import {
  Channel,
  ComponentRegistry,
  DeclareChannel,
  ServiceDescriptor,
} from './service';

// =========================================
// DTO
// =========================================

export class ServiceRequest {
  service!: string;
  method!: string;
  args: any[] = [];
}

export class ServiceReply {
  success!: boolean;
  result?: any;
  error?: string;
}

// =========================================
// HTTP Channel
// =========================================

@DeclareChannel('http')
@Injectable()
export class HttpChannel implements Channel {
  url?: string;

  constructor(private readonly http: HttpService) {}

  async call(
    descriptor: ServiceDescriptor,
    method: string,
    ...args: any[]
  ): Promise<any> {

    const request = plainToInstance(ServiceRequest, {
      service: descriptor.name,
      method,
      args,
    });

    const response = await firstValueFrom(
      this.http.post(
        this.url!,
        instanceToPlain(request),
        {
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const reply = plainToInstance(ServiceReply, response.data);

    if (!reply.success) {
      throw new Error(reply.error || 'Remote service call failed');
    }

    return reply.result;
  }
}

// =========================================
// HTTP Controller
// =========================================

@Controller('/service')
export class ServiceController {
  constructor(private readonly registry: ComponentRegistry) {}

  @Post()
  async invoke(@Body() body: any): Promise<ServiceReply> {
    const request = plainToInstance(ServiceRequest, body);

    try {
      const descriptor = (this.registry as any).services.get(
        request.service,
      ) as ServiceDescriptor;

      if (!descriptor) {
        throw new Error(`Unknown service ${request.service}`);
      }

      if (!descriptor.instance) {
        throw new Error(
          `Service ${request.service} has no local implementation`,
        );
      }

      const fn = (descriptor.instance as any)[request.method];

      if (typeof fn !== 'function') {
        throw new Error(
          `Method ${request.method} not found on ${request.service}`,
        );
      }

      const result = await fn.apply(
        descriptor.instance,
        request.args || [],
      );

      return plainToInstance(ServiceReply, {
        success: true,
        result,
      });
    } catch (e: any) {
      return plainToInstance(ServiceReply, {
        success: false,
        error: e?.message || 'Unknown error',
      });
    }
  }
}

// =========================================
// HTTP Transport Module
// =========================================

@Module({
  controllers: [ServiceController],
  providers: [HttpChannel],
  exports: [HttpChannel],
})
export class HttpTransportModule {}
